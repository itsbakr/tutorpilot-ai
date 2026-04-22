"""
Daytona Sandbox Service
Manages code deployment to Daytona sandboxes using the official Daytona SDK

Documentation: https://www.daytona.io/docs/
SDK Reference: https://www.daytona.io/docs/python-sdk-reference/

Key Features:
- Automatic port exposure (3000-9999)
- Preview URLs: https://{PORT}-{SANDBOX_ID}.{RUNNER_DOMAIN}.daytona.work
- Complete Vite + React setup with proper boilerplate
- Session-based command execution for better log tracking
- Utilizes the new AsyncDaytona SDK for non-blocking I/O operations
"""

import os
import asyncio
import json
import time
from typing import Dict, Any, Optional
from daytona import AsyncDaytona, DaytonaConfig, CodeLanguage, CreateSandboxFromSnapshotParams, SessionExecuteRequest


class DaytonaService:
    """Service for managing Daytona sandboxes using the official SDK"""
    
    def __init__(self):
        api_key = os.getenv("DAYTONA_API_KEY")
        if not api_key:
            raise ValueError("DAYTONA_API_KEY environment variable not set")
        
        # Initialize Daytona client configuration
        self.config = DaytonaConfig(api_key=api_key)
        self.react_port = 3000  # Vite dev server port
    
    async def create_and_deploy_react_app(
        self,
        code: str,
        student_id: Optional[str] = None,
        auto_stop_interval: int = 120  # 2 hours for tutoring sessions
    ) -> Dict[str, Any]:
        """
        Create a Daytona sandbox and deploy React code with complete Vite setup
        
        Based on Daytona docs: https://www.daytona.io/docs/
        
        Args:
            code: React/JavaScript code (will be saved as src/App.jsx)
            student_id: Student identifier for tracking (optional)
            auto_stop_interval: Minutes before auto-stop (120 = 2 hours for demos)
            
        Returns:
            Dict with sandbox_id, url, status, exit_code, session_id
        """
        async with AsyncDaytona(self.config) as daytona:
            try:
                session_id = f"react-dev-{student_id or 'demo'}"
                
                # Generate unique sandbox name with timestamp to prevent collisions
                unique_suffix = int(time.time() * 1000)  # Millisecond timestamp
                sandbox_name = f"tp-{student_id or 'demo'}-{unique_suffix}"
                
                # Step 1: Create sandbox with Node.js
                print(f"📦 Creating Daytona sandbox: {sandbox_name}...")
                params = CreateSandboxFromSnapshotParams(
                    language=CodeLanguage.JAVASCRIPT,  # Node.js environment
                    name=sandbox_name,
                    labels={
                        "app": "tutorpilot",
                        "student_id": student_id or "demo",
                        "type": "react-activity"
                    },
                    public=True,  # ✅ CRITICAL: Make preview publicly accessible!
                    auto_stop_interval=auto_stop_interval,  # 2 hours
                    auto_archive_interval=1440,  # 24 hours
                    auto_delete_interval=180,  # 3 hours (good for hackathon demos)
                )
                
                sandbox = await daytona.create(params)
                print(f"✅ Created sandbox: {sandbox.id}")
                
                # Step 2: Create complete Vite + React project structure
                print("📝 Setting up Vite + React project...")
                
                # 2a. Create package.json
                package_json = {
                    "name": "tutorpilot-activity",
                    "type": "module",
                    "version": "1.0.0",
                    "dependencies": {
                        "react": "^18.2.0",
                        "react-dom": "^18.2.0",
                    },
                    "devDependencies": {
                        "vite": "^5.0.0",
                        "@vitejs/plugin-react": "^4.0.0",
                        "tailwindcss": "^3.4.0",
                        "postcss": "^8.4.32",
                        "autoprefixer": "^10.4.16"
                    },
                    "scripts": {
                        "dev": "vite --host 0.0.0.0 --port 3000"
                    }
                }
                package_json_bytes = json.dumps(package_json, indent=2).encode('utf-8')
                await sandbox.fs.upload_file(package_json_bytes, "package.json")
                
                # 2b. Create vite.config.js
                vite_config = """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  }
})
"""
                await sandbox.fs.upload_file(vite_config.encode('utf-8'), "vite.config.js")
                
                # 2c. Create tailwind.config.js
                tailwind_config = """/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"""
                await sandbox.fs.upload_file(tailwind_config.encode('utf-8'), "tailwind.config.js")
                
                # 2d. Create postcss.config.js
                postcss_config = """export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"""
                await sandbox.fs.upload_file(postcss_config.encode('utf-8'), "postcss.config.js")
                
                # 2c. Create index.html
                index_html = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TutorPilot Activity</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"""
                await sandbox.fs.upload_file(index_html.encode('utf-8'), "index.html")
                
                # 2e. Create src/index.css with Tailwind directives
                index_css = """@tailwind base;
@tailwind components;
@tailwind utilities;
"""
                await sandbox.fs.upload_file(index_css.encode('utf-8'), "src/index.css")
                
                # 2f. Create src/main.jsx with CSS import
                main_jsx = """import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
"""
                await sandbox.fs.upload_file(main_jsx.encode('utf-8'), "src/main.jsx")
                
                # 2g. Upload the generated React component
                await sandbox.fs.upload_file(code.encode('utf-8'), "src/App.jsx")
                
                print("✅ Project structure created with Tailwind CSS!")
                
                # Step 3: Create process session for command execution
                print("🔧 Creating process session...")
                await sandbox.process.create_session(session_id)
                
                # Step 4: Install dependencies (including Tailwind!)
                print("📦 Installing dependencies (this may take 60-90 seconds with Tailwind)...")
                install_response = await sandbox.process.execute_session_command(
                    session_id,
                    SessionExecuteRequest(command="npm install")
                )
                install_cmd_id = install_response.cmd_id  # Extract command ID from response
                
                # Wait longer for Tailwind installation
                await asyncio.sleep(8)
                install_logs = await sandbox.process.get_session_command_logs(
                    session_id,
                    install_cmd_id
                )
                
                # Check logs (SessionCommandLogsResponse attributes: output, cmd_id)
                if "error" in str(install_logs.output).lower() or "failed" in str(install_logs.output).lower():
                    print(f"⚠️ Installation warnings detected in logs")
                else:
                    print("✅ Dependencies installed")
                
                # Step 5: Start Vite dev server (async, non-blocking)
                print("🚀 Starting Vite dev server...")
                dev_response = await sandbox.process.execute_session_command(
                    session_id,
                    SessionExecuteRequest(command="npm run dev", var_async=True)  # Run in background
                )
                dev_cmd_id = dev_response.cmd_id  # Extract command ID from response
                
                # Wait for server to start and compile
                print("⏳ Waiting for Vite to compile...")
                await asyncio.sleep(10)  # Increased from 8 to 10 seconds
                
                # Step 6: Get preview link (opens port automatically)
                print(f"🔗 Getting preview URL for port {self.react_port}...")
                preview_info = await sandbox.get_preview_link(self.react_port)
                
                sandbox_url = preview_info.url
                print(f"✅ React app deployed: {sandbox_url}")
                
                # Check for compilation errors by triggering compilation
                print("🔍 Checking for compilation errors...")
                errors_detected = False
                final_logs = None
                
                # Try to fetch the URL to trigger compilation
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        print(f"🌐 Triggering compilation by fetching: {sandbox_url}")
                        await client.get(sandbox_url)
                        # Wait for compilation to complete and errors to appear in logs
                        await asyncio.sleep(3)
                except Exception as e:
                    print(f"⚠️ Could not fetch URL (may be normal): {str(e)[:100]}")
                    # Continue anyway - errors might still be in logs
                
                for check_attempt in range(3):  # Check 3 times over 15 seconds
                    dev_logs = await sandbox.process.get_session_command_logs(
                        session_id,
                        dev_cmd_id
                    )
                    
                    logs_output = str(dev_logs.output)
                    logs_lower = logs_output.lower()
                    
                    # Check for compilation errors (including babel/parser errors)
                    has_error_keywords = any([
                        "syntaxerror" in logs_lower,
                        "parse error" in logs_lower,
                        "missing semicolon" in logs_lower,
                        "unexpected token" in logs_lower,
                        "failed to compile" in logs_lower,
                        "plugin:vite:react-babel" in logs_lower,  # Vite React plugin errors
                        "@babel/parser" in logs_lower,  # Babel parser errors
                        ("error" in logs_lower and "ready in" not in logs_lower and "error handling" not in logs_lower)
                    ])
                    
                    if has_error_keywords:
                        errors_detected = True
                        final_logs = logs_output
                        print(f"⚠️ Compilation errors detected on check {check_attempt + 1}/3")
                        break
                    
                    if check_attempt < 2:
                        await asyncio.sleep(5)  # Wait 5 more seconds before next check
                
                return {
                    "sandbox_id": sandbox.id,
                    "url": sandbox_url,
                    "status": "running",  # Sandbox is running (but may have compilation errors)
                    "exit_code": 0,
                    "session_id": session_id,
                    "dev_command_id": dev_cmd_id,
                    "logs": final_logs if errors_detected else None  # Include logs if errors found
                }
                
            except Exception as e:
                error_msg = str(e)
                print(f"❌ Daytona deployment error: {error_msg}")
                import traceback
                traceback.print_exc()
                return {
                    "sandbox_id": None,
                    "url": None,
                    "status": "failed",
                    "exit_code": 1,
                    "error": error_msg
                }
    
    async def get_sandbox_logs(
        self,
        sandbox_id: str,
        session_id: str,
        command_id: str
    ) -> Dict[str, Any]:
        """
        Get error and output logs from a specific command execution
        
        Based on: https://www.daytona.io/docs/process-execution/
        
        Args:
            sandbox_id: Sandbox identifier
            session_id: Session identifier (e.g., "react-dev-{student_id}")
            command_id: Command identifier returned from execute_session_command
            
        Returns:
            Dict with stdout, stderr, output, exit_code
        """
        async with AsyncDaytona(self.config) as daytona:
            try:
                # Get the sandbox
                sandbox = await daytona.get(sandbox_id)
                
                # Get session command logs
                logs = await sandbox.process.get_session_command_logs(
                    session_id,
                    command_id
                )
                
                return {
                    "stdout": logs.stdout,
                    "stderr": logs.stderr,
                    "output": logs.output,  # Combined stdout + stderr
                    "exit_code": logs.exit_code,
                    "has_errors": logs.exit_code != 0 or "error" in logs.stderr.lower()
                }
                
            except Exception as e:
                return {
                    "stdout": "",
                    "stderr": f"Error fetching logs: {str(e)}",
                    "output": f"Error fetching logs: {str(e)}",
                    "exit_code": 1,
                    "has_errors": True
                }
    
    async def delete_sandbox(
        self,
        sandbox_id: str,
        session_id: Optional[str] = None
    ) -> bool:
        """
        Delete a sandbox (and optionally clean up session first)
        
        Based on: https://github.com/daytonaio/daytona/issues/2510
        
        Args:
            sandbox_id: Sandbox identifier
            session_id: Optional session ID to clean up first (prevents connection errors)
            
        Returns:
            True if successful
        """
        async with AsyncDaytona(self.config) as daytona:
            try:
                # Get the sandbox
                sandbox = await daytona.get(sandbox_id)
                
                # Clean up session first if provided (prevents log streaming errors)
                if session_id:
                    try:
                        await sandbox.process.delete_session(session_id)
                        print(f"✅ Cleaned up session: {session_id}")
                    except Exception as e:
                        print(f"⚠️ Session cleanup warning: {str(e)}")
                
                # Delete the sandbox
                await sandbox.delete()
                
                print(f"✅ Deleted sandbox: {sandbox_id}")
                return True
                
            except Exception as e:
                print(f"⚠️ Error deleting sandbox: {str(e)}")
                return False


# Global instance
daytona_service = DaytonaService()
