"""Regressão manual assistida no APK instalado; não limpa dados nem cria cobrança."""
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

adb = str(Path.home() / '.nutrifoto/android/sdk/platform-tools/adb.exe')
pasta = Path(__file__).resolve().parent.parent / 'evidencias/licencas'
resultados = []
ambiente = 'APK instalado no emulador API 36; backend não configurado; sem Pix/IA externos'
if '--planos' in sys.argv or '--reabrir' in sys.argv:
    resultados = json.loads((pasta / 'android-botoes.json').read_text(encoding='utf-8'))['aprovados']

def executar(*args):
    return subprocess.check_output([adb, '-s', 'emulator-5554', *args], timeout=35).decode('utf-8', 'replace')

def ler_tela():
    for tentativa in range(6):
        saida=executar('shell', 'uiautomator', 'dump', '/sdcard/nutrifoto-botoes.xml')
        if 'dumped to' in saida:
            return executar('shell', 'cat', '/sdcard/nutrifoto-botoes.xml')
        time.sleep(1)
    raise AssertionError('UI Automator indisponível; XML anterior não pode comprovar o estado atual')

def tocar(texto):
    for tentativa in range(8):
        tela = ET.fromstring(ler_tela())
        for item in sorted(tela.iter('node'), key=lambda n: (n.get('text') != texto, n.get('class') != 'android.widget.Button')):
            if texto not in item.get('text', ''):
                continue
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', item.get('bounds')))
            if y2 > y1 and y1 >= 90 and y2 < (1600 if texto in ['MEU PLANO','INÍCIO','CONFIG.','HISTÓRICO'] else 1455):
                assert item.get('enabled') == 'true', texto + ' está desabilitado'
                executar('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                time.sleep(.4)
                return
        executar('shell', 'input', 'swipe', '350', '1300', '350', '400', '300')
    raise AssertionError('Controle não encontrado: ' + texto)

def verificar(nome, trecho):
    for tentativa in range(4):
        tela = ler_tela()
        if trecho in tela:
            break
        time.sleep(1)
    assert trecho in tela, nome
    (pasta / ('android-botoes-' + str(len(resultados)+1) + '.xml')).write_text(tela, encoding='utf-8')
    resultados.append(nome)
    print('APROVADO ' + nome, flush=True)

def ler_campos_perfil():
    for tentativa in range(4):
        tela = ET.fromstring(ler_tela())
        campos={item.get('resource-id'):item.get('text') for item in tela.iter('node') if item.get('resource-id') in ['dp-idade','dp-peso','dp-altura']}
        if len(campos)==3:
            return campos
        time.sleep(1)
    return campos

def capturar(nome):
    imagem = subprocess.check_output([adb,'-s','emulator-5554','exec-out','screencap','-p'],timeout=30)
    (pasta / nome).write_bytes(imagem)

if '--reabrir' in sys.argv:
    verificar('Reabertura mantém aplicativo funcional', 'Seu NutriFoto')
    (pasta / 'android-botoes.json').write_text(json.dumps({'ambiente':'APK 0.3.1 (5) instalado no emulador API 36; backend não configurado; sem Pix/IA externos', 'aprovados':resultados}, ensure_ascii=False, indent=2), encoding='utf-8')
    sys.exit(0)

try:
    if '--planos' not in sys.argv:
        tocar('Pagar com Pix')
        verificar('Pix sem servidor explica consulta pendente', 'Toque em Atualizar ativação')
        tocar('Atualizar ativação')
        verificar('Atualizar explica ausência de servidor', 'precisa disponibilizar o servidor')
        tocar('Recuperar uma compra')
        tocar('Transferir para este dispositivo')
        verificar('Transferir explica ausência de servidor', 'precisa disponibilizar o servidor')
        tocar('Gerar código de recuperação')
        verificar('Recuperação explica ausência de servidor', 'precisa disponibilizar o servidor')
    tocar('MEU PLANO')
    perfil_anterior=ler_campos_perfil()
    assert len(perfil_anterior)==3, 'Perfil existente deve estar acessível antes de testar persistência'
    tocar('Salvar perfil')
    verificar('Perfil pode ser salvo sem gerar plano', 'Perfil salvo neste dispositivo')
    tocar('Gerar rascunho')
    verificar('Plano clínico permanece bloqueado com explicação', 'aguardam homologação nutricional')
    tocar('Estou gestante ou amamentando')
    tocar('Gerar rascunho')
    verificar('Gestação mostra motivo específico', 'ainda não foi homologada')
    capturar('android-plano-bloqueado-0.3.2.png')
    tocar('Estou gestante ou amamentando')
    executar('shell', 'am', 'force-stop', 'com.nutrifoto.app')
    executar('shell', 'am', 'start', '-n', 'com.nutrifoto.app/.MainActivity')
    time.sleep(2)
    verificar('Reabertura mantém aplicativo funcional', 'Seu NutriFoto')
    capturar('android-ativacao-0.3.2.png')
    tocar('MEU PLANO')
    assert ler_campos_perfil()==perfil_anterior, 'Valores do perfil devem sobreviver ao encerramento forçado'
    resultados.append('Perfil preservado após encerramento forçado')
    tocar('INÍCIO')
    tocar('Adicionar alimento')
    tocar('Analisar')
    verificar('Análise sem foto explica entrada necessária', 'Tire uma foto ou escolha uma imagem')
finally:
    (pasta / 'android-botoes.json').write_text(json.dumps({'ambiente':ambiente, 'pacote':executar('shell','dumpsys','package','com.nutrifoto.app').split('versionName=')[1].splitlines()[0], 'aprovados':resultados}, ensure_ascii=False, indent=2), encoding='utf-8')
