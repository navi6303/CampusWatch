"""Run the isolated browser review against dist with an already installed Chromium and Playwright."""
import functools
import http.server
import os
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    site = Path(tmp)
    shutil.copytree(root / 'dist', site, dirs_exist_ok=True)
    (site / 'test').mkdir()
    for name in ('browser-review.html', 'frame.html'):
        shutil.copyfile(root / 'test' / name, site / 'test' / name)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(site))
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as server, sync_playwright() as driver:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        browser = driver.chromium.launch(executable_path=os.getenv('CHROMIUM_BIN') or shutil.which('chromium'))
        page = browser.new_page(viewport={'width': 1440, 'height': 1050})
        page.goto(f'http://127.0.0.1:{server.server_port}/test/browser-review.html')
        page.get_by_role('button', name='Run checks').click()
        page.wait_for_function("['PASS','FAIL'].includes(document.querySelector('#result').textContent)", timeout=120000)
        print(page.locator('#log').inner_text())
        assert page.locator('#result').inner_text() == 'PASS'
        browser.close()
        server.shutdown()
