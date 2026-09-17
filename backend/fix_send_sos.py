import re

with open("main.py", "r") as f:
    content = f.read()

pattern = re.compile(
    r'def send_sos\(req: SosRequest\):.*?return \{"message": "Simulated sending emails\. Set credentials to actually send\."\}',
    re.DOTALL
)

replacement = '''def send_sos(req: SosRequest):
        # sender_email = os.environ.get("SENDER_EMAIL", "tgurubani@gmail.com")
        # sender_password = os.environ.get("SENDER_PASSWORD", "cbsd nhxx wooo ghmw")
        sender_email = os.environ.get("SENDER_EMAIL")
        sender_password = os.environ.get("SENDER_PASSWORD")

        if not sender_email or not sender_password:
            print("WARNING: Email not sent. Please set SENDER_EMAIL and SENDER_PASSWORD environment variables.")
            return {"message": "Simulated sending emails. Set credentials to actually send."}'''

new_content, count = pattern.subn(replacement, content)
print("Replacements made:", count)

with open("main.py", "w") as f:
    f.write(new_content)
