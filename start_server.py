#!/usr/bin/env python
"""
Startup script for Devils Advocate API Server.
Handles zombie port cleanup and graceful shutdown.
"""
import subprocess
import sys
import os
import signal
import time
import atexit

# Configuration
BACKEND_PORT = 8005
FRONTEND_PORT = 3005

def get_pids_on_port(port: int) -> list[int]:
    """Get list of PIDs using a specific port on Windows."""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            timeout=10
        )
        pids = set()
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                if parts:
                    try:
                        pid = int(parts[-1])
                        if pid != 0:  # Skip system process
                            pids.add(pid)
                    except ValueError:
                        pass
        return list(pids)
    except Exception as e:
        print(f"Error checking port {port}: {e}")
        return []

def kill_zombie_processes(port: int) -> bool:
    """Kill any processes using the specified port."""
    pids = get_pids_on_port(port)
    
    if not pids:
        print(f"[OK] Port {port} is free")
        return True
    
    print(f"[WARN] Found {len(pids)} process(es) on port {port}: {pids}")
    
    for pid in pids:
        try:
            # Skip our own process
            if pid == os.getpid():
                continue
                
            print(f"  Terminating PID {pid}...")
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/F"],
                capture_output=True,
                timeout=5
            )
        except Exception as e:
            print(f"  Failed to kill PID {pid}: {e}")
    
    # Wait a moment for ports to be released
    time.sleep(1)
    
    # Verify port is now free
    remaining = get_pids_on_port(port)
    if remaining:
        print(f"[FAIL] Port {port} still in use by: {remaining}")
        return False
    
    print(f"[OK] Port {port} is now free")
    return True

def cleanup_ports():
    """Cleanup function to run on exit."""
    print("\n[STOP] Shutting down server...")

def main():
    print("=" * 50)
    print("Devils Advocate Server Startup")
    print("=" * 50)
    
    # Register cleanup handler
    atexit.register(cleanup_ports)
    
    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        print("\n\n[INTR] Received interrupt signal")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Kill zombie processes on backend port
    print(f"\n[1/2] Checking port {BACKEND_PORT}...")
    if not kill_zombie_processes(BACKEND_PORT):
        print(f"\n[FAIL] Failed to free port {BACKEND_PORT}. Try manually:")
        print(f"  taskkill /F /IM python.exe")
        sys.exit(1)
    
    # Change to project directory
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)
    
    # Set up environment
    print(f"\n[2/2] Starting Uvicorn on port {BACKEND_PORT}...")
    print("-" * 50)
    
    # Start uvicorn
    try:
        import uvicorn
        from dotenv import load_dotenv
        
        # Load environment variables
        load_dotenv()
        
        uvicorn.run(
            "src.server:api_server",
            host="0.0.0.0",
            port=BACKEND_PORT,
            reload=False,  # Disable reload to prevent zombie processes
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n[STOP] Server stopped by user")
    except Exception as e:
        print(f"\n[FAIL] Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
