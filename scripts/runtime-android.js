import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

if(Capacitor.isNativePlatform())iniciarPlataforma();
function iniciarPlataforma(){
  let imagemRestaurada=null,aoVoltar=null;
  const buscarWeb=window.fetch.bind(window);
  const origem=NUTRIFOTO_BACKEND_ORIGIN;
  window.fetch=async(entrada,opcoes={})=>{
    const endereco=new URL(typeof entrada==='string'?entrada:entrada.url,location.href);
    if(endereco.origin!==location.origin||!endereco.pathname.startsWith('/api/'))return buscarWeb(entrada,opcoes);
    if(!origem)throw Object.assign(new Error('A conexão de ativação ainda não está configurada nesta versão. O responsável precisa disponibilizar o servidor antes de habilitar o Pix. Seus registros locais continuam disponíveis.'),{codigo:'BACKEND_NAO_CONFIGURADO'});
    if(opcoes.signal?.aborted)throw new DOMException('Cancelado','AbortError');
    const cabecalhos=Object.fromEntries(new Headers(opcoes.headers||{}));
    cabecalhos.Origin=origem;
    // Não persistir cookies no código JS; a sessão usa o CookieManager nativo do Capacitor.
    const pedido=CapacitorHttp.request({url:origem+endereco.pathname+endereco.search,method:opcoes.method||'GET',headers:cabecalhos,...(opcoes.body?{data:JSON.parse(opcoes.body)}:{}),responseType:'json',connectTimeout:10000,readTimeout:25000,disableRedirects:true});
    let cancelar;
    try{
      const resposta=await Promise.race([pedido,new Promise((_,rejeitar)=>{cancelar=()=>rejeitar(new DOMException('Cancelado','AbortError'));opcoes.signal?.addEventListener('abort',cancelar,{once:true});})]);
      const headers=new Headers();for(const [nome,valor]of Object.entries(resposta.headers||{}))if(nome.toLowerCase()!=='set-cookie'&&nome.toLowerCase()!=='null')headers.set(nome,String(valor));
      return new Response(typeof resposta.data==='string'?resposta.data:JSON.stringify(resposta.data),{status:resposta.status,headers});
    }finally{opcoes.signal?.removeEventListener('abort',cancelar);}
  };
  async function selecionarFoto(camera){
    try{const foto=await Camera.getPhoto({source:camera?CameraSource.Camera:CameraSource.Photos,resultType:CameraResultType.DataUrl,quality:80,width:1024,height:1024,correctOrientation:true,saveToGallery:false,allowEditing:false});return {dataUrl:foto.dataUrl};}
    catch(erro){if(/cancel|canceled|0006|0013|0020/i.test(erro.message||erro.code||''))return null;throw new Error(camera?'Não foi possível abrir a câmera. Confira as permissões do aplicativo de câmera ou escolha uma foto da galeria.':'Não foi possível abrir a foto. Escolha uma imagem disponível no dispositivo.');}
  }
  window.NutriFotoAndroid={
    selecionarFoto,
    aoVoltar:funcao=>{aoVoltar=funcao;},
    minimizar:()=>App.minimizeApp(),
    recuperarImagem:()=>{const imagem=imagemRestaurada;imagemRestaurada=null;return imagem;},
    exportarArquivo:async(blob,nome)=>{
      const salvo=await Filesystem.writeFile({path:nome,data:await blob.text(),directory:Directory.Cache,encoding:Encoding.UTF8});
      await Share.share({title:'Exportar dados do NutriFoto',url:salvo.uri,dialogTitle:'Salvar ou compartilhar seu arquivo'});
    },
  };
  App.addListener('backButton',()=>aoVoltar?.());
  App.addListener('appStateChange',evento=>{if(evento.isActive)window.dispatchEvent(new Event('focus'));});
  App.addListener('appRestoredResult',resultado=>{
    if(resultado.pluginId==='Camera'&&resultado.success&&resultado.data?.dataUrl){imagemRestaurada={dataUrl:resultado.data.dataUrl};window.dispatchEvent(new Event('nutrifoto:imagem-restaurada'));}
  });
}
