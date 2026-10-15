import os
import shutil
import subprocess
from concurrent.futures import ProcessPoolExecutor

PROJECT_ROOT = os.path.abspath('.')
SOURCE_DIR = os.path.join(PROJECT_ROOT, 'Assets', 'Assets Frames', 'frames')
DESKTOP_DIR = os.path.join(PROJECT_ROOT, 'public', 'frames', 'desktop')
MOBILE_DIR = os.path.join(PROJECT_ROOT, 'public', 'frames', 'mobile')
VIDEO_DIR = os.path.join(PROJECT_ROOT, 'public', 'video')

os.makedirs(DESKTOP_DIR, exist_ok=True)
os.makedirs(MOBILE_DIR, exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)

def clean_dir(d):
    for f in os.listdir(d):
        fp = os.path.join(d, f)
        if os.path.isfile(fp):
            os.remove(fp)

def convert_mobile_frame(filename):
    src = os.path.join(SOURCE_DIR, filename)
    dst = os.path.join(MOBILE_DIR, filename)
    # Scale to 960x540 with webp quality 75
    cmd = [
        'ffmpeg', '-y', '-i', src,
        '-vf', 'scale=960:540',
        '-c:v', 'libwebp', '-quality', '75',
        dst
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return dst

def main():
    print('=== Updating Hero Frames to 192 Frames ===')
    source_files = sorted([f for f in os.listdir(SOURCE_DIR) if f.startswith('frame_') and f.endswith('.webp')])
    count = len(source_files)
    print(f'Found {count} source frames in {SOURCE_DIR}')
    
    # 1. Clean and Copy Desktop Frames
    print('[1/4] Copying 192 desktop frames...')
    clean_dir(DESKTOP_DIR)
    for f in source_files:
        shutil.copy2(os.path.join(SOURCE_DIR, f), os.path.join(DESKTOP_DIR, f))
    print(f'Copied {len(os.listdir(DESKTOP_DIR))} frames to {DESKTOP_DIR}')
    
    # 2. Clean and Generate Mobile Frames
    print('[2/4] Generating 192 mobile frames (960x540)...')
    clean_dir(MOBILE_DIR)
    with ProcessPoolExecutor(max_workers=os.cpu_count() or 4) as executor:
        list(executor.map(convert_mobile_frame, source_files))
    print(f'Generated {len(os.listdir(MOBILE_DIR))} frames in {MOBILE_DIR}')
    
    # 3. Generate Video fallback
    print('[3/4] Generating fallback MP4 video...')
    mp4_out = os.path.join(VIDEO_DIR, 'portrait.mp4')
    desktop_pattern = os.path.join(DESKTOP_DIR, 'frame_%04d.webp')
    subprocess.run([
        'ffmpeg', '-y', '-r', '24',
        '-i', desktop_pattern,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
        mp4_out
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(f'Video generated at {mp4_out}')
    
    # 4. Audit sizes
    print('[4/4] Auditing asset sizes...')
    desktop_sizes = [os.path.getsize(os.path.join(DESKTOP_DIR, f)) for f in os.listdir(DESKTOP_DIR) if f.endswith('.webp')]
    mobile_sizes = [os.path.getsize(os.path.join(MOBILE_DIR, f)) for f in os.listdir(MOBILE_DIR) if f.endswith('.webp')]
    desktop_mb = sum(desktop_sizes) / (1024 * 1024)
    mobile_mb = sum(mobile_sizes) / (1024 * 1024)
    video_mb = os.path.getsize(mp4_out) / (1024 * 1024)
    print(f'Desktop: {len(desktop_sizes)} frames, {desktop_mb:.2f} MB')
    print(f'Mobile:  {len(mobile_sizes)} frames, {mobile_mb:.2f} MB')
    print(f'Video:   {video_mb:.2f} MB')
    print('=== Done ===')

if __name__ == '__main__':
    main()
