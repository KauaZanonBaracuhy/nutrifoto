"""Gera CA e certificado efêmeros exclusivamente para a homologação local."""
import datetime
import ipaddress
import pathlib
import sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID

pasta = pathlib.Path(sys.argv[1])
agora = datetime.datetime.now(datetime.timezone.utc)
chave_ca = rsa.generate_private_key(public_exponent=65537, key_size=2048)
nome_ca = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "NutriFoto CA temporaria local")])
ca = (x509.CertificateBuilder().subject_name(nome_ca).issuer_name(nome_ca)
      .public_key(chave_ca.public_key()).serial_number(x509.random_serial_number())
      .not_valid_before(agora-datetime.timedelta(minutes=5)).not_valid_after(agora+datetime.timedelta(days=1))
      .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True).sign(chave_ca, hashes.SHA256()))
chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
nome = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "127.0.0.1")])
certificado = (x509.CertificateBuilder().subject_name(nome).issuer_name(nome_ca)
               .public_key(chave.public_key()).serial_number(x509.random_serial_number())
               .not_valid_before(agora-datetime.timedelta(minutes=5)).not_valid_after(agora+datetime.timedelta(days=1))
               .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address("127.0.0.1")), x509.DNSName("localhost")]), critical=False)
               .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
               .sign(chave_ca, hashes.SHA256()))
(pasta / "ca.pem").write_bytes(ca.public_bytes(serialization.Encoding.PEM))
(pasta / "cert.pem").write_bytes(certificado.public_bytes(serialization.Encoding.PEM))
(pasta / "key.pem").write_bytes(chave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
