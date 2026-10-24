package com.nutrifoto.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.ECGenParameterSpec;
import org.json.JSONObject;
import org.json.JSONArray;

public class MainActivity extends BridgeActivity {
  private static final String ALIAS = "nutrifoto.instalacao.v1";
  private volatile String identidadePronta;
  private boolean preparandoIdentidade;

  @Override public void onCreate(Bundle estado) {
    super.onCreate(estado);
    bridge.getWebView().addJavascriptInterface(this, "NutriFotoKeystore");
  }
  @JavascriptInterface public synchronized String identidade() {
    if (identidadePronta != null) {
      String pronta = identidadePronta;
      if (pronta.startsWith("{\"erro\"")) { identidadePronta = null; preparandoIdentidade = false; }
      return pronta;
    }
    if (!preparandoIdentidade) { preparandoIdentidade = true; new Thread(() -> identidadePronta = prepararIdentidade()).start(); }
    return "{\"pendente\":true}";
  }
  private String prepararIdentidade() {
    try {
      KeyStore armazenamento = KeyStore.getInstance("AndroidKeyStore"); armazenamento.load(null);
      if (!armazenamento.containsAlias(ALIAS)) {
        KeyPairGenerator gerador = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
        KeyGenParameterSpec.Builder parametros = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
          .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256);
        byte[] desafio = new byte[32]; new SecureRandom().nextBytes(desafio);
        gerador.initialize(parametros.setAttestationChallenge(desafio).build()); gerador.generateKeyPair();
      }
      byte[] publica = armazenamento.getCertificate(ALIAS).getPublicKey().getEncoded();
      StringBuilder chave = new StringBuilder(); for (byte parte : MessageDigest.getInstance("SHA-256").digest(publica)) chave.append(String.format("%02x", parte & 255));
      JSONArray certificados = new JSONArray(); for (java.security.cert.Certificate certificado : armazenamento.getCertificateChain(ALIAS)) certificados.put(Base64.encodeToString(certificado.getEncoded(), Base64.NO_WRAP));
      return new JSONObject().put("chave", chave.toString()).put("publica", Base64.encodeToString(publica, Base64.NO_WRAP)).put("certificados", certificados).toString();
    } catch (Exception erro) { return "{\"erro\":\"Não foi possível preparar a identidade desta instalação.\"}"; }
  }
  @JavascriptInterface public synchronized String assinar(String nonce, String resumo) {
    try {
      if (!nonce.matches("[A-Za-z0-9_-]{43}") || !resumo.matches("[a-f0-9]{64}")) return "";
      KeyStore armazenamento = KeyStore.getInstance("AndroidKeyStore"); armazenamento.load(null);
      Signature assinatura = Signature.getInstance("SHA256withECDSA");
      assinatura.initSign((java.security.PrivateKey) armazenamento.getKey(ALIAS, null));
      assinatura.update(("NF1\n" + nonce + "\n" + resumo).getBytes(java.nio.charset.StandardCharsets.UTF_8));
      return Base64.encodeToString(assinatura.sign(), Base64.NO_WRAP);
    } catch (Exception erro) { return ""; }
  }
  @JavascriptInterface public synchronized String intencao(String resumo) {
    try {
      if (!resumo.matches("[a-f0-9]{64}")) throw new Exception();
      android.content.SharedPreferences preferencias = getSharedPreferences("nutrifoto.intencoes", MODE_PRIVATE);
      String anterior = preferencias.getString(resumo, null); if (anterior != null) return anterior;
      if (preferencias.getAll().size() >= 100) return "{\"erro\":\"Há análises sem confirmação. Procure o suporte.\"}";
      String valor = new JSONObject().put("chave", java.util.UUID.randomUUID().toString()).put("criadoEm", System.currentTimeMillis()).toString();
      if (!preferencias.edit().putString(resumo, valor).commit()) throw new Exception();
      return valor;
    } catch (Exception erro) { return "{\"erro\":\"Não foi possível preservar a intenção de análise. Nenhuma chamada foi enviada.\"}"; }
  }
  @JavascriptInterface public synchronized boolean concluirIntencao(String resumo, String chave) {
    try {
      android.content.SharedPreferences preferencias = getSharedPreferences("nutrifoto.intencoes", MODE_PRIVATE);
      String valor = preferencias.getString(resumo, null);
      if (valor == null || !new JSONObject(valor).getString("chave").equals(chave)) return false;
      return preferencias.edit().remove(resumo).commit();
    } catch (Exception erro) { return false; }
  }
}
