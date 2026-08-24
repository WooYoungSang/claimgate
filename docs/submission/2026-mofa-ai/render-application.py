from pathlib import Path
import markdown
from weasyprint import HTML
root=Path(__file__).resolve().parent
md=(root/'claimgate-oda-participation-application.md').read_text(encoding='utf-8')
css=(root/'claimgate-oda-form.css').read_text(encoding='utf-8')
body=markdown.markdown(md,extensions=['extra'])
html=f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
(root/'claimgate-oda-participation-application.preview.html').write_text(html,encoding='utf-8')
HTML(string=html,base_url=str(root)).write_pdf(root/'claimgate-oda-participation-application.pdf')
print(root/'claimgate-oda-participation-application.pdf')
