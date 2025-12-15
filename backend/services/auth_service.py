"""
Supabase Auth Service
Handles authentication, session validation, and user management
"""

from fastapi import HTTPException, Header, Depends
from typing import Optional, Dict, Any
import os
from supabase import create_client, Client
from gotrue.errors import AuthApiError
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()

# Create Supabase client for auth
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_ANON_KEY", "")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")  # For admin operations

supabase: Client = create_client(supabase_url, supabase_key)

# Admin client for privileged operations (like creating users)
supabase_admin: Optional[Client] = None
if supabase_service_key:
    supabase_admin = create_client(supabase_url, supabase_service_key)


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "tutor"  # 'tutor' or 'admin'
    teaching_style: Optional[str] = None
    education_system: Optional[str] = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class UpdatePasswordRequest(BaseModel):
    password: str


class AuthenticatedUser(BaseModel):
    id: str
    email: str
    role: str
    tutor_id: Optional[str] = None
    name: Optional[str] = None


async def get_current_user(authorization: str = Header(None)) -> AuthenticatedUser:
    """
    Validate JWT token from Authorization header and return user info.
    Use as a dependency in protected routes.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    
    try:
        # Verify the JWT token with Supabase
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user = user_response.user
        user_metadata = user.user_metadata or {}
        
        # Get tutor_id from metadata or lookup in tutors table
        tutor_id = user_metadata.get("tutor_id")
        
        # If no tutor_id in metadata, try to find by email
        if not tutor_id:
            tutor_response = supabase.table('tutors').select('id').eq('email', user.email).execute()
            if tutor_response.data and len(tutor_response.data) > 0:
                tutor_id = tutor_response.data[0]['id']
        
        return AuthenticatedUser(
            id=user.id,
            email=user.email,
            role=user_metadata.get("role", "tutor"),
            tutor_id=tutor_id,
            name=user_metadata.get("name", user.email.split("@")[0])
        )
        
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")


async def get_optional_user(authorization: str = Header(None)) -> Optional[AuthenticatedUser]:
    """
    Optional auth - returns None if no auth header, user if valid.
    Use for routes that work with or without auth.
    """
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


class AuthService:
    """Service for handling authentication operations"""
    
    @staticmethod
    async def sign_up(request: SignUpRequest) -> Dict[str, Any]:
        """
        Sign up a new user and create their tutor profile
        """
        try:
            # Sign up with Supabase Auth
            auth_response = supabase.auth.sign_up({
                "email": request.email,
                "password": request.password,
                "options": {
                    "data": {
                        "name": request.name,
                        "role": request.role
                    }
                }
            })
            
            if not auth_response.user:
                raise HTTPException(status_code=400, detail="Failed to create user")
            
            user_id = auth_response.user.id
            
            # Create tutor record in tutors table
            tutor_data = {
                "id": user_id,  # Use auth user ID as tutor ID for easy linking
                "name": request.name,
                "email": request.email,
                "teaching_style": request.teaching_style or "Adaptive and personalized",
                "education_system": request.education_system or "General"
            }
            
            tutor_response = supabase.table('tutors').insert(tutor_data).execute()
            
            if not tutor_response.data:
                # Rollback - delete auth user if tutor creation failed
                # Note: This is a simplified approach
                raise HTTPException(status_code=500, detail="Failed to create tutor profile")
            
            # Update user metadata with tutor_id
            # This requires service role key
            if supabase_admin:
                try:
                    supabase_admin.auth.admin.update_user_by_id(
                        user_id,
                        {"user_metadata": {"tutor_id": user_id, "name": request.name, "role": request.role}}
                    )
                except Exception as e:
                    print(f"Warning: Could not update user metadata: {e}")
            
            return {
                "success": True,
                "user_id": user_id,
                "tutor_id": user_id,
                "email": request.email,
                "name": request.name,
                "message": "Account created successfully! Please check your email to verify your account."
            }
            
        except AuthApiError as e:
            if "User already registered" in str(e):
                raise HTTPException(status_code=400, detail="An account with this email already exists")
            raise HTTPException(status_code=400, detail=f"Sign up failed: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Sign up error: {str(e)}")
    
    @staticmethod
    async def sign_in(request: SignInRequest) -> Dict[str, Any]:
        """
        Sign in an existing user
        """
        try:
            auth_response = supabase.auth.sign_in_with_password({
                "email": request.email,
                "password": request.password
            })
            
            if not auth_response.user or not auth_response.session:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            
            user = auth_response.user
            session = auth_response.session
            user_metadata = user.user_metadata or {}
            
            # Get tutor_id
            tutor_id = user_metadata.get("tutor_id")
            if not tutor_id:
                tutor_response = supabase.table('tutors').select('id, name').eq('email', user.email).execute()
                if tutor_response.data and len(tutor_response.data) > 0:
                    tutor_id = tutor_response.data[0]['id']
            
            return {
                "success": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user_metadata.get("name", user.email.split("@")[0]),
                    "role": user_metadata.get("role", "tutor"),
                    "tutor_id": tutor_id
                },
                "session": {
                    "access_token": session.access_token,
                    "refresh_token": session.refresh_token,
                    "expires_at": session.expires_at,
                    "expires_in": session.expires_in
                }
            }
            
        except AuthApiError as e:
            if "Invalid login credentials" in str(e):
                raise HTTPException(status_code=401, detail="Invalid email or password")
            raise HTTPException(status_code=401, detail=f"Sign in failed: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Sign in error: {str(e)}")
    
    @staticmethod
    async def sign_out(access_token: str) -> Dict[str, Any]:
        """
        Sign out the current user
        """
        try:
            supabase.auth.sign_out()
            return {"success": True, "message": "Signed out successfully"}
        except Exception as e:
            # Even if there's an error, we consider it logged out client-side
            return {"success": True, "message": "Signed out"}
    
    @staticmethod
    async def reset_password(request: ResetPasswordRequest) -> Dict[str, Any]:
        """
        Send password reset email
        """
        try:
            supabase.auth.reset_password_for_email(
                request.email,
                options={
                    "redirect_to": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/auth/reset-password"
                }
            )
            return {
                "success": True,
                "message": "If an account exists with this email, you will receive a password reset link"
            }
        except Exception as e:
            # Don't reveal whether email exists
            return {
                "success": True,
                "message": "If an account exists with this email, you will receive a password reset link"
            }
    
    @staticmethod
    async def refresh_session(refresh_token: str) -> Dict[str, Any]:
        """
        Refresh the access token using refresh token
        """
        try:
            response = supabase.auth.refresh_session(refresh_token)
            
            if not response.session:
                raise HTTPException(status_code=401, detail="Failed to refresh session")
            
            session = response.session
            user = response.user
            
            return {
                "success": True,
                "session": {
                    "access_token": session.access_token,
                    "refresh_token": session.refresh_token,
                    "expires_at": session.expires_at,
                    "expires_in": session.expires_in
                },
                "user": {
                    "id": user.id if user else None,
                    "email": user.email if user else None
                }
            }
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Session refresh failed: {str(e)}")
    
    @staticmethod
    async def get_user_profile(user: AuthenticatedUser) -> Dict[str, Any]:
        """
        Get full user profile including tutor details
        """
        try:
            if not user.tutor_id:
                return {
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": user.name,
                        "role": user.role
                    },
                    "tutor": None,
                    "students_count": 0
                }
            
            # Get tutor profile
            tutor_response = supabase.table('tutors').select('*').eq('id', user.tutor_id).execute()
            tutor = tutor_response.data[0] if tutor_response.data else None
            
            # Get student count
            students_response = supabase.table('students').select('id', count='exact').eq('tutor_id', user.tutor_id).execute()
            students_count = students_response.count if hasattr(students_response, 'count') else len(students_response.data or [])
            
            return {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                    "tutor_id": user.tutor_id
                },
                "tutor": tutor,
                "students_count": students_count
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")


# Singleton instance
auth_service = AuthService()




