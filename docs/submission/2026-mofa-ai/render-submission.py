from pathlib import Path
import markdown
from weasyprint import HTML
root=Path(__file__).resolve().parent

def render(name,css_name,parse_markdown=True):
    src=(root/f'{name}.md').read_text(encoding='utf-8')
    body=markdown.markdown(src,extensions=['extra']) if parse_markdown else src
    css=(root/css_name).read_text(encoding='utf-8')
    html=f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
    (root/f'{name}.preview.html').write_text(html,encoding='utf-8')
    HTML(string=html,base_url=str(root)).write_pdf(root/f'{name}.pdf')
    print(root/f'{name}.pdf')

render('claimgate-oda-participation-application','claimgate-oda-form.css',False)
render('claimgate-oda-product-service-proposal','claimgate-oda-proposal.css',True)
render('claimgate-oda-privacy-consent','claimgate-oda-form.css',False)
