import os
import glob
import json
from PIL import Image

def compress_images(directory):
    # Support jpg, jpeg, png
    extensions = ('*.png', '*.jpg', '*.jpeg')
    files_to_convert = []
    
    for ext in extensions:
        files_to_convert.extend(glob.glob(os.path.join(directory, '**', ext), recursive=True))

    replacements = {}
    
    for file_path in files_to_convert:
        try:
            with Image.open(file_path) as img:
                # Keep same name but change extension
                base = os.path.splitext(file_path)[0]
                webp_path = base + '.webp'
                
                # Convert and save as WebP
                img.save(webp_path, 'WEBP', quality=80, optimize=True)
                
                # Get relative paths for replacement
                old_rel = file_path.replace('/workspace/awesome-iwb/frontend/public', '')
                new_rel = webp_path.replace('/workspace/awesome-iwb/frontend/public', '')
                replacements[old_rel] = new_rel
                
                print(f"Converted: {file_path} -> {webp_path}")
                os.remove(file_path) # Remove original
        except Exception as e:
            print(f"Error converting {file_path}: {e}")
            
    return replacements

def update_references(replacements):
    # Update data.json
    data_file = '/workspace/awesome-iwb/backend/src/data.json'
    with open(data_file, 'r', encoding='utf-8') as f:
        data_content = f.read()
        
    for old, new in replacements.items():
        data_content = data_content.replace(old, new)
        
    with open(data_file, 'w', encoding='utf-8') as f:
        f.write(data_content)
        
    # Update Vue files
    vue_files = glob.glob('/workspace/awesome-iwb/frontend/src/**/*.vue', recursive=True)
    for vue_file in vue_files:
        with open(vue_file, 'r', encoding='utf-8') as f:
            vue_content = f.read()
            
        modified = False
        for old, new in replacements.items():
            if old in vue_content:
                vue_content = vue_content.replace(old, new)
                modified = True
                
        if modified:
            with open(vue_file, 'w', encoding='utf-8') as f:
                f.write(vue_content)

if __name__ == '__main__':
    public_dir = '/workspace/awesome-iwb/frontend/public'
    print("Compressing images to WebP...")
    replacements = compress_images(public_dir)
    print("Updating references...")
    update_references(replacements)
    print("Done!")
