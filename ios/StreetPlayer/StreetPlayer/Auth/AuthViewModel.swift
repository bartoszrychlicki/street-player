import AuthenticationServices
import CryptoKit
import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import Security
import SwiftUI

@MainActor
final class AuthViewModel: ObservableObject {
    @Published private(set) var user: User?
    @Published var email = ""
    @Published var password = ""
    @Published var errorMessage: String?

    private var listener: AuthStateDidChangeListenerHandle?
    private var currentNonce: String?

    var isSignedIn: Bool { user != nil }

    func start() async {
        listener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in self?.user = user }
        }
    }

    func idToken() async throws -> String {
        guard let user = Auth.auth().currentUser else {
            throw NSError(domain: "StreetPlayerAuth", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not signed in"])
        }
        return try await user.getIDToken()
    }

    func signInWithEmail() async {
        errorMessage = nil
        do {
            _ = try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createAccountWithEmail() async {
        errorMessage = nil
        do {
            _ = try await Auth.auth().createUser(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signInWithGoogle() async {
        errorMessage = nil
        do {
            guard let clientID = FirebaseApp.app()?.options.clientID else {
                throw NSError(domain: "StreetPlayerAuth", code: 500, userInfo: [NSLocalizedDescriptionKey: "Missing Firebase client ID"])
            }
            guard let root = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?.rootViewController else {
                throw NSError(domain: "StreetPlayerAuth", code: 500, userInfo: [NSLocalizedDescriptionKey: "No presenting view controller"])
            }

            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: root)
            guard let idToken = result.user.idToken?.tokenString else {
                throw NSError(domain: "StreetPlayerAuth", code: 500, userInfo: [NSLocalizedDescriptionKey: "Missing Google ID token"])
            }

            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )
            _ = try await Auth.auth().signIn(with: credential)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func prepareAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = randomNonceString()
        currentNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
    }

    func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        Task {
            errorMessage = nil
            do {
                guard case .success(let authorization) = result else {
                    if case .failure(let error) = result { throw error }
                    return
                }
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                      let nonce = currentNonce,
                      let tokenData = credential.identityToken,
                      let token = String(data: tokenData, encoding: .utf8) else {
                    throw NSError(domain: "StreetPlayerAuth", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid Apple credential"])
                }

                let firebaseCredential = OAuthProvider.appleCredential(
                    withIDToken: token,
                    rawNonce: nonce,
                    fullName: credential.fullName
                )
                _ = try await Auth.auth().signIn(with: firebaseCredential)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
            GIDSignIn.sharedInstance.signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            if status != errSecSuccess {
                fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(status)")
            }

            randoms.forEach { random in
                if remainingLength == 0 { return }
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }

        return result
    }

    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.map { String(format: "%02x", $0) }.joined()
    }
}
