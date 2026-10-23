function selecionarArquivo(usarCamera) {
  return new Promise((resolver, rejeitar) => {
    const entrada = document.createElement('input'); entrada.type = 'file'; entrada.accept = 'image/jpeg,image/png,image/webp';
    if (usarCamera) entrada.setAttribute('capture', 'environment');
    entrada.hidden = true; document.body.append(entrada);
    entrada.oncancel = () => { entrada.remove(); resolver(null); };
    entrada.onchange = () => {
      const arquivo = entrada.files?.[0]; entrada.remove(); if (!arquivo) return resolver(null);
      if (!['image/jpeg','image/png','image/webp'].includes(arquivo.type) || arquivo.size > 12 * 1024 * 1024) { rejeitar(new Error('Escolha uma imagem JPEG, PNG ou WebP de até 12 MB.')); return; }
      const leitor = new FileReader(); leitor.onerror = () => rejeitar(new Error('Não foi possível ler a imagem. Escolha outro arquivo.'));
      leitor.onload = () => resolver({ dataUrl: leitor.result }); leitor.readAsDataURL(arquivo);
    }; entrada.click();
  });
}
export function captureFromCamera() { return window.NutriFotoAndroid?window.NutriFotoAndroid.selecionarFoto(true):selecionarArquivo(true); }
export function pickFromGallery() { return window.NutriFotoAndroid?window.NutriFotoAndroid.selecionarFoto(false):selecionarArquivo(false); }
export function downscaleImage(enderecoImagem, dimensaoMaxima = 1024) {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image(); const temporizador = setTimeout(() => rejeitar(new Error('Tempo esgotado ao abrir a imagem.')), 10000);
    function falharImagem() { clearTimeout(temporizador); rejeitar(new Error('Imagem inválida. Escolha outro arquivo e tente novamente.')); }
    imagem.onerror = falharImagem;
    imagem.onload = () => {
      try {
        if (!imagem.width || !imagem.height || imagem.width * imagem.height > 50000000) return falharImagem();
        const proporcao = Math.min(1, dimensaoMaxima / Math.max(imagem.width, imagem.height));
        const tela = document.createElement('canvas'); tela.width = Math.round(imagem.width * proporcao); tela.height = Math.round(imagem.height * proporcao);
        tela.getContext('2d').drawImage(imagem, 0, 0, tela.width, tela.height);
        const dataUrl = tela.toDataURL('image/jpeg', 0.8); clearTimeout(temporizador); resolver({ dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      } catch { falharImagem(); }
    }; imagem.src = enderecoImagem;
  });
}
