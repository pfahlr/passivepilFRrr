#!/usr/bin/env python3

import sys, json, struct, os

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('<I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length)
    return json.loads(message.decode('utf-8'))

def send_message(msg):
    encoded = json.dumps(msg).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def main():
    while True:
        try:
            msg = read_message()
        except Exception:
            break

        op = msg.get('op')
        if op == 'append':
            path = msg.get('path')
            lines = msg.get('lines', [])
            try:
                # Ensure directory exists
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, 'a', encoding='utf-8') as f:
                    for line in lines:
                        # Each entry on its own line
                        f.write((line or '') + '\n')
                    f.flush()
                send_message({"ok": True})
            except Exception as e:
                send_message({"ok": False, "error": str(e)})
        else:
            send_message({"ok": False, "error": "unknown op"})

if __name__ == "__main__":
    main()
