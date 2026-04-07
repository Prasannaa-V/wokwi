import shutil
import os
import sys

Import("env")

def post_program_action(source, target, env):
    """Copy firmware files to project root after build"""
    try:
        build_dir = env.subst("$BUILD_DIR")
        project_dir = env.subst("$PROJECT_DIR")
        
        firmware_bin = os.path.join(build_dir, "firmware.bin")
        firmware_elf = os.path.join(build_dir, "firmware.elf")
        
        dest_bin = os.path.join(project_dir, "firmware.bin")
        dest_elf = os.path.join(project_dir, "firmware.elf")
        
        if os.path.exists(firmware_bin):
            shutil.copy2(firmware_bin, dest_bin)
            print("[Wokwi] Copied firmware.bin to project root")
        
        if os.path.exists(firmware_elf):
            shutil.copy2(firmware_elf, dest_elf)
            print("[Wokwi] Copied firmware.elf to project root")
    except Exception as e:
        print(f"[Wokwi] Error copying firmware: {e}", file=sys.stderr)

env.AddPostAction("$BUILD_DIR/${PROGNAME}.bin", post_program_action)
