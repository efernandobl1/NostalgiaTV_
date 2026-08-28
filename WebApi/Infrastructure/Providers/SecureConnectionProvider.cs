using Microsoft.Extensions.Configuration;
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace Infrastructure.Providers
{
    /// <summary>
    /// Reads encrypted connection strings from Windows Registry,
    /// decrypts + verifies signature using the certificate from Windows Store.
    /// Optionally validates that the certificate was signed by a specific CA thumbprint.
    /// Register as Singleton — decrypts once on startup, stays in memory.
    /// </summary>
    public class SecureConnectionProvider
    {
        private readonly Dictionary<string, string> _connections = new();

        public SecureConnectionProvider(IConfiguration config)
        {
            var thumbprint = config["Database:Certificate:Thumbprint"] ?? throw new Exception("Database:Certificate:Thumbprint not configured.");
            var caThumbprint = config["Database:Certificate:CaThumbprint"]; // optional — if set, validates chain

            var scope = config["Database:Certificate:Scope"] == "LocalMachine"
                ? StoreLocation.LocalMachine
                : StoreLocation.CurrentUser;

            var regScope = scope == StoreLocation.LocalMachine
                ? RegistryScope.LocalMachine
                : RegistryScope.CurrentUser;

            var folder = config["Database:Registry:Folder"] ?? "SecureConnString";
            var subKey = config["Database:Registry:SubKey"] ?? "Connections";

            var cert = LoadCertFromStore(thumbprint, scope);

            // If CaThumbprint is configured, validate the certificate chain
            // This prevents someone from using a cert signed by a different CA
            if (!string.IsNullOrWhiteSpace(caThumbprint))
                ValidateCertSignedByCA(cert, caThumbprint);

            foreach (var name in ListRegistry(regScope, folder, subKey))
            {
                var encrypted = ReadRegistry(name, regScope, folder, subKey);
                _connections[name] = DecryptAndVerify(encrypted, cert);
            }
        }

        public string Get(string name)
        {
            if (_connections.TryGetValue(name, out var value)) return value;
            throw new Exception($"Connection string '{name}' not found.");
        }

        // ── CA chain validation ───────────────────────────────────────────

        // Verifies that the cert was signed by the CA with the expected thumbprint.
        // Protects against someone creating another CA with the same CN and signing a fake cert.
        private static void ValidateCertSignedByCA(X509Certificate2 cert, string expectedCaThumbprint)
        {
            using var chain = new X509Chain();
            chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
            chain.ChainPolicy.VerificationFlags = X509VerificationFlags.AllowUnknownCertificateAuthority;
            chain.ChainPolicy.DisableCertificateDownloads = true;

            chain.Build(cert);

            foreach (var element in chain.ChainElements)
            {
                if (element.Certificate.Thumbprint.Equals(expectedCaThumbprint, StringComparison.OrdinalIgnoreCase))
                    return; // found the expected CA in the chain
            }

            throw new CryptographicException(
                $"Certificate '{cert.GetNameInfo(X509NameType.SimpleName, false)}' was not signed by the expected CA (thumbprint: {expectedCaThumbprint[..16]}...). " +
                "The certificate may have been issued by an unauthorized authority.");
        }

        // ── Private helpers ───────────────────────────────────────────────

        private static X509Certificate2 LoadCertFromStore(string thumbprint, StoreLocation location)
        {
            using var store = new X509Store(StoreName.My, location);
            store.Open(OpenFlags.ReadOnly);
            var results = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, false);
            if (results.Count == 0) throw new Exception($"Certificate not found: {thumbprint}");
            return results[0];
        }

        private static List<string> ListRegistry(RegistryScope scope, string folder, string subKey)
        {
            var hive = scope == RegistryScope.LocalMachine ? Registry.LocalMachine : Registry.CurrentUser;
            using var key = hive.OpenSubKey($@"SOFTWARE\{folder}\{subKey}");
            return key == null ? new() : new List<string>(key.GetValueNames());
        }

        private static string ReadRegistry(string name, RegistryScope scope, string folder, string subKey)
        {
            var hive = scope == RegistryScope.LocalMachine ? Registry.LocalMachine : Registry.CurrentUser;
            using var key = hive.OpenSubKey($@"SOFTWARE\{folder}\{subKey}")
                ?? throw new Exception($@"Registry key SOFTWARE\{folder}\{subKey} not found.");
            return key.GetValue(name) as string
                ?? throw new Exception($"Entry '{name}' not found.");
        }

        // Layout: [2b: sig len][RSA signature][2b: RSA key len][encrypted AES key][12b: nonce][16b: GCM tag][ciphertext]
        private static string DecryptAndVerify(string encryptedBase64, X509Certificate2 cert)
        {
            var raw = Convert.FromBase64String(encryptedBase64);

            using var ms = new MemoryStream(raw);
            using var br = new BinaryReader(ms);

            var sigLen = br.ReadUInt16();
            var signature = br.ReadBytes(sigLen);
            var blob = br.ReadBytes((int)(ms.Length - ms.Position));

            // Verify RSA-SHA256 signature — detects any tampering of the encrypted data
            using var rsaVerify = cert.GetRSAPublicKey()!;
            if (!rsaVerify.VerifyData(blob, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1))
                throw new CryptographicException("Signature invalid — data may have been tampered.");

            using var inner = new MemoryStream(blob);
            using var ibr = new BinaryReader(inner);
            var rsaKeyLen = ibr.ReadUInt16();
            var encryptedAesKey = ibr.ReadBytes(rsaKeyLen);
            var nonce = ibr.ReadBytes(12);
            var tag = ibr.ReadBytes(16);
            var cipherBytes = ibr.ReadBytes((int)(inner.Length - inner.Position));

            using var rsaDec = cert.GetRSAPrivateKey()!;
            var aesKey = rsaDec.Decrypt(encryptedAesKey, RSAEncryptionPadding.OaepSHA256);

            var plainBytes = new byte[cipherBytes.Length];
            using (var aesGcm = new AesGcm(aesKey, 16))
                aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);

            return Encoding.UTF8.GetString(plainBytes);
        }

        private enum RegistryScope { CurrentUser, LocalMachine }
    }
}
