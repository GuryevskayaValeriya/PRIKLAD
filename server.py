"""
Локальный сервер для открытия интерактивного учебника PRIKLAD.
Не требует установки сторонних библиотек (использует стандартную библиотеку Python).

Запуск:
    python server.py
"""
import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


def run_server():
    os.chdir(DIRECTORY)
    url = f"http://localhost:{PORT}/index.html"
    print("=" * 65)
    print(f"🚀 Интерактивный учебник запущен на: {url}")
    print(f"📁 Корневая папка: {DIRECTORY}")
    print("Нажмите Ctrl+C для остановки сервера.")
    print("=" * 65)

    webbrowser.open(url)

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер остановлен.")


if __name__ == "__main__":
    run_server()
