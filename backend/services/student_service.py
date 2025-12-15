"""
Student Management Service
Handles CRUD operations for students under a tutor
"""

from fastapi import HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from db.supabase_client import supabase


class CreateStudentRequest(BaseModel):
    name: str
    grade: str
    subject: str
    learning_style: Optional[str] = "Visual"
    nationality: Optional[str] = None
    residence: Optional[str] = None
    languages: Optional[List[str]] = []
    interests: Optional[List[str]] = []
    objectives: Optional[List[str]] = []


class UpdateStudentRequest(BaseModel):
    name: Optional[str] = None
    grade: Optional[str] = None
    subject: Optional[str] = None
    learning_style: Optional[str] = None
    nationality: Optional[str] = None
    residence: Optional[str] = None
    languages: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    objectives: Optional[List[str]] = None


class StudentService:
    """Service for managing students"""
    
    @staticmethod
    async def create_student(tutor_id: str, data: CreateStudentRequest) -> Dict[str, Any]:
        """Create a new student for a tutor"""
        try:
            student_data = {
                "tutor_id": tutor_id,
                "name": data.name,
                "grade": data.grade,
                "subject": data.subject,
                "learning_style": data.learning_style or "Visual",
                "nationality": data.nationality,
                "residence": data.residence,
                "languages": data.languages or [],
                "interests": data.interests or [],
                "objectives": data.objectives or []
            }
            
            response = supabase.table('students').insert(student_data).execute()
            
            if not response.data:
                raise HTTPException(status_code=500, detail="Failed to create student")
            
            return {
                "success": True,
                "student": response.data[0],
                "message": "Student created successfully"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating student: {str(e)}")
    
    @staticmethod
    async def get_students(tutor_id: str) -> Dict[str, Any]:
        """Get all students for a tutor"""
        try:
            response = supabase.table('students')\
                .select('*')\
                .eq('tutor_id', tutor_id)\
                .order('created_at', desc=True)\
                .execute()
            
            return {
                "success": True,
                "students": response.data or [],
                "count": len(response.data or [])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching students: {str(e)}")
    
    @staticmethod
    async def get_student(student_id: str, tutor_id: str) -> Dict[str, Any]:
        """Get a specific student (with ownership check)"""
        try:
            response = supabase.table('students')\
                .select('*')\
                .eq('id', student_id)\
                .eq('tutor_id', tutor_id)\
                .execute()
            
            if not response.data:
                raise HTTPException(status_code=404, detail="Student not found")
            
            return {
                "success": True,
                "student": response.data[0]
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching student: {str(e)}")
    
    @staticmethod
    async def update_student(student_id: str, tutor_id: str, data: UpdateStudentRequest) -> Dict[str, Any]:
        """Update a student (with ownership check)"""
        try:
            # First check ownership
            check = supabase.table('students')\
                .select('id')\
                .eq('id', student_id)\
                .eq('tutor_id', tutor_id)\
                .execute()
            
            if not check.data:
                raise HTTPException(status_code=404, detail="Student not found or access denied")
            
            # Build update dict with only provided fields
            update_data = {}
            if data.name is not None:
                update_data['name'] = data.name
            if data.grade is not None:
                update_data['grade'] = data.grade
            if data.subject is not None:
                update_data['subject'] = data.subject
            if data.learning_style is not None:
                update_data['learning_style'] = data.learning_style
            if data.nationality is not None:
                update_data['nationality'] = data.nationality
            if data.residence is not None:
                update_data['residence'] = data.residence
            if data.languages is not None:
                update_data['languages'] = data.languages
            if data.interests is not None:
                update_data['interests'] = data.interests
            if data.objectives is not None:
                update_data['objectives'] = data.objectives
            
            if not update_data:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            response = supabase.table('students')\
                .update(update_data)\
                .eq('id', student_id)\
                .execute()
            
            return {
                "success": True,
                "student": response.data[0] if response.data else None,
                "message": "Student updated successfully"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error updating student: {str(e)}")
    
    @staticmethod
    async def delete_student(student_id: str, tutor_id: str) -> Dict[str, Any]:
        """Delete a student (with ownership check)"""
        try:
            # First check ownership
            check = supabase.table('students')\
                .select('id, name')\
                .eq('id', student_id)\
                .eq('tutor_id', tutor_id)\
                .execute()
            
            if not check.data:
                raise HTTPException(status_code=404, detail="Student not found or access denied")
            
            student_name = check.data[0]['name']
            
            # Delete the student
            supabase.table('students').delete().eq('id', student_id).execute()
            
            return {
                "success": True,
                "message": f"Student '{student_name}' deleted successfully"
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting student: {str(e)}")
    
    @staticmethod
    async def get_student_stats(tutor_id: str) -> Dict[str, Any]:
        """Get statistics for all students of a tutor"""
        try:
            # Get all students
            students_response = supabase.table('students')\
                .select('id, name, subject, grade')\
                .eq('tutor_id', tutor_id)\
                .execute()
            
            students = students_response.data or []
            
            # Get counts for content
            stats = {
                "total_students": len(students),
                "students_by_subject": {},
                "students_by_grade": {},
                "content_counts": {
                    "strategies": 0,
                    "lessons": 0,
                    "activities": 0
                }
            }
            
            for student in students:
                # Count by subject
                subject = student.get('subject', 'Unknown')
                stats["students_by_subject"][subject] = stats["students_by_subject"].get(subject, 0) + 1
                
                # Count by grade
                grade = student.get('grade', 'Unknown')
                stats["students_by_grade"][grade] = stats["students_by_grade"].get(grade, 0) + 1
            
            # Get content counts
            for student in students:
                student_id = student['id']
                
                strategies = supabase.table('strategies')\
                    .select('id', count='exact')\
                    .eq('student_id', student_id)\
                    .execute()
                stats["content_counts"]["strategies"] += len(strategies.data or [])
                
                lessons = supabase.table('lessons')\
                    .select('id', count='exact')\
                    .eq('student_id', student_id)\
                    .execute()
                stats["content_counts"]["lessons"] += len(lessons.data or [])
                
                activities = supabase.table('activities')\
                    .select('id', count='exact')\
                    .eq('student_id', student_id)\
                    .execute()
                stats["content_counts"]["activities"] += len(activities.data or [])
            
            return {
                "success": True,
                "stats": stats
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")


# Singleton instance
student_service = StudentService()




