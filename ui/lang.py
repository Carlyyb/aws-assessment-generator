import os
import re
import json

# 设置React+TypeScript前端代码目录
root_dir = './src'

# 设置输出目录
output_dir = './src/i18n'

# 设置语言代码
lang_code = 'en'

# 正则表达式模式，用于匹配UI文本
text_pattern = r'"([^"]+)"|\'([^\']+)\''

# 记录替换操作
replacements = {}

# 遍历React+TypeScript前端代码目录
for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            file_path = os.path.join(root, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # 匹配UI文本
                texts = re.findall(text_pattern, content)
                # 生成嵌套的en.json文件
                en_json = {}
                for text in texts:
                    text = text[0] or text[1]
                    # 生成嵌套的键值对
                    keys = text.split('.')
                    current = en_json
                    for key in keys[:-1]:
                        if key not in current:
                            current[key] = {}
                        current = current[key]
                    current[keys[-1]] = text
                # 记录替换操作
                replacements[file_path] = []
                for text in texts:
                    text = text[0] or text[1]
                    replacements[file_path].append((text, f'getLangResource("{text}")'))
                # 输出en.json文件
                output_file_path = os.path.join(output_dir, f'{file.replace(".tsx", "").replace(".ts", "")}_{lang_code}.json')
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    json.dump(en_json, f, indent=4)

# 让您确认结果
print("以下是替换操作的结果，请确认后再进行代码文件的替换：")
for file_path, replacements_list in replacements.items():
    print(f"文件：{file_path}")
    for text, replacement in replacements_list:
        print(f"  {text} -> {replacement}")

confirm = input("确认结果？（yes/no）：")
if confirm.lower() == "yes":
    # 进行代码文件的替换
    for file_path, replacements_list in replacements.items():
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        for text, replacement in replacements_list:
            content = content.replace(f'"{text}"', replacement)
            content = content.replace(f"'{text}'", replacement)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    print("代码文件的替换完成！")
else:
    print("替换操作已取消。")