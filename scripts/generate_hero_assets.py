import os
import sys
import time
import subprocess
from concurrent.futures import ProcessPoolExecutor

PROJECT_ROOT = os.path.abspath('.')
SOURCE_IMG = os.path.join(PROJECT_ROOT, 'Assets', 'Editing_photo_hairstyle_and_outfit_2K_20261013145839.jpg')
DESKTOP_DIR = os.path.join(PROJECT_ROOT, 'public', 'frames', 'desktop')
MOBILE_DIR = os.path.join(PROJECT_ROOT, 'public', 'frames', 'mobile')
POSTERS_DIR = os.path.join(PROJECT_ROOT, 'public', 'posters')
VIDEO_DIR = os.path.join(PROJECT_ROOT, 'public', 'video')

os.makedirs(DESKTOP_DIR, exist_ok=True)
os.makedirs(MOBILE_DIR, exist_ok=True)
os.makedirs(POSTERS_DIR, exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)

def ease_in_out(t):
    return t * t * (3.0 - 2.0 * t)

def render_desktop_frame(i, total=120):
    t = i / float(total - 1)
    ease = ease_in_out(t)
    w = 1536.0 - (1536.0 - 1152.0) * ease
    h = 864.0 - (864.0 - 648.0) * ease
    x = 0.0 + (213.0 - 0.0) * ease
    y = 280.0 + (360.0 - 280.0) * ease
    crop_vf = f"crop={int(w)}:{int(h)}:{int(x)}:{int(y)},scale=1920:1080"
    out_path = os.path.join(DESKTOP_DIR, f"frame_{i+1:04d}.webp")
    cmd = [
        'ffmpeg', '-y', '-i', SOURCE_IMG,
        '-vf', crop_vf,
        '-c:v', 'libwebp', '-quality', '75',
        out_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return out_path

def render_mobile_frame(i, total=90):
    t = i / float(total - 1)
    ease = ease_in_out(t)
    w = 1440.0 - (1440.0 - 900.0) * ease
    h = 1920.0 - (1920.0 - 1200.0) * ease
    x = 48.0 + (339.0 - 48.0) * ease
    y = 180.0 + (280.0 - 180.0) * ease
    crop_vf = f"crop={int(w)}:{int(h)}:{int(x)}:{int(y)},scale=900:1200"
    out_path = os.path.join(MOBILE_DIR, f"frame_{i+1:04d}.webp")
    cmd = [
        'ffmpeg', '-y', '-i', SOURCE_IMG,
        '-vf', crop_vf,
        '-c:v', 'libwebp', '-quality', '72',
        out_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return out_path

def main():
    print('=== Starting Hero Assets Generation ===')
    start_time = time.time()
    
    # 1. Generate Posters & OG image
    print('[1/5] Generating poster and OG images...')
    poster_jpg = os.path.join(POSTERS_DIR, 'portrait.jpg')
    poster_webp = os.path.join(POSTERS_DIR, 'portrait.webp')
    og_jpg = os.path.join(POSTERS_DIR, 'og-image.jpg')
    
    # Poster (close-up portrait)
    subprocess.run([
        'ffmpeg', '-y', '-i', SOURCE_IMG,
        '-vf', 'crop=1024:1365:256:240,scale=900:1200',
        '-q:v', '2', poster_jpg
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    
    subprocess.run([
        'ffmpeg', '-y', '-i', SOURCE_IMG,
        '-vf', 'crop=1024:1365:256:240,scale=900:1200',
        '-c:v', 'libwebp', '-quality', '80', poster_webp
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    
    # OG Image 1200x630 (landscape social share banner)
    subprocess.run([
        'ffmpeg', '-y', '-i', SOURCE_IMG,
        '-vf', 'crop=1536:806:0:300,scale=1200:630',
        '-q:v', '2', og_jpg
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print('Posters created.')
    
    # 2. Generate Desktop frames (120 frames)
    print('[2/5] Generating 120 Desktop frames (1920x1080)...')
    with ProcessPoolExecutor(max_workers=os.cpu_count() or 4) as executor:
        list(executor.map(render_desktop_frame, range(120)))
    print('120 Desktop frames generated.')
    
    # 3. Generate Mobile frames (90 frames)
    print('[3/5] Generating 90 Mobile frames (900x1200)...')
    with ProcessPoolExecutor(max_workers=os.cpu_count() or 4) as executor:
        list(executor.map(render_mobile_frame, range(90)))
    print('90 Mobile frames generated.')
    
    # 4. Generate MP4 Video Clip from Desktop frames
    print('[4/5] Encoding hero MP4 video (5 seconds at 24fps)...')
    mp4_out = os.path.join(VIDEO_DIR, 'portrait.mp4')
    desktop_pattern = os.path.join(DESKTOP_DIR, 'frame_%04d.webp')
    subprocess.run([
        'ffmpeg', '-y', '-r', '24',
        '-i', desktop_pattern,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
        mp4_out
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print('MP4 Video created.')
    
    # 5. Audit sizes against TRD budgets
    print('[5/5] Auditing asset sizes against performance budget...')
    desktop_sizes = [os.path.getsize(os.path.join(DESKTOP_DIR, f)) for f in os.listdir(DESKTOP_DIR) if f.endswith('.webp')]
    mobile_sizes = [os.path.getsize(os.path.join(MOBILE_DIR, f)) for f in os.listdir(MOBILE_DIR) if f.endswith('.webp')]
    desktop_total_mb = sum(desktop_sizes) / (1024 * 1024)
    mobile_total_mb = sum(mobile_sizes) / (1024 * 1024)
    
    print(f'Desktop: {len(desktop_sizes)} frames, Total = {desktop_total_mb:.2f} MB (Budget: <= 10.0 MB) -> {"PASS" if desktop_total_mb <= 10.0 else "FAIL"}')
    print(f'Mobile:  {len(mobile_sizes)} frames, Total = {mobile_total_mb:.2f} MB (Budget: <= 4.0 MB) -> {"PASS" if mobile_total_mb <= 4.0 else "FAIL"}')
    print(f'Completed in {time.time() - start_time:.2f} seconds.')

if __name__ == '__main__':
    main()
