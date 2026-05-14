import AuthenticationServices
import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var auth: AuthViewModel
    @State private var isCreatingAccount = false

    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            GeometryReader { proxy in
                ScrollView {
                    VStack(spacing: 22) {
                        VStack(spacing: 8) {
                            Text("Street Player")
                                .font(.largeTitle.bold())
                            Text("Native walk recording for city exploration.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        VStack(spacing: 12) {
                            TextField("Email", text: $auth.email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .textFieldStyle(.roundedBorder)
                                .accessibilityIdentifier("emailField")

                            SecureField("Password", text: $auth.password)
                                .textContentType(isCreatingAccount ? .newPassword : .password)
                                .textFieldStyle(.roundedBorder)
                                .accessibilityIdentifier("passwordField")

                            Button(isCreatingAccount ? "Create account" : "Sign in") {
                                Task {
                                    if isCreatingAccount {
                                        await auth.createAccountWithEmail()
                                    } else {
                                        await auth.signInWithEmail()
                                    }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                            .accessibilityIdentifier("emailAuthButton")

                            Button(isCreatingAccount ? "I already have an account" : "Create an email account") {
                                isCreatingAccount.toggle()
                            }
                            .font(.footnote)
                            .accessibilityIdentifier("toggleEmailModeButton")
                        }

                        VStack(spacing: 12) {
                            SignInWithAppleButton(.signIn) { request in
                                auth.prepareAppleRequest(request)
                            } onCompletion: { result in
                                auth.handleAppleCompletion(result)
                            }
                            .signInWithAppleButtonStyle(.black)
                            .frame(height: 48)
                            .accessibilityIdentifier("appleSignInButton")

                            Button {
                                Task { await auth.signInWithGoogle() }
                            } label: {
                                HStack(spacing: 18) {
                                    Text("G")
                                        .font(.title2.bold())
                                        .foregroundStyle(.blue)
                                        .frame(width: 28)
                                    Text("Sign in with Google")
                                        .font(.headline)
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.plain)
                            .frame(height: 48)
                            .background(.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 2)
                                    .stroke(Color(.separator), lineWidth: 0.5)
                            )
                            .shadow(color: .black.opacity(0.18), radius: 4, y: 2)
                            .accessibilityIdentifier("googleSignInButton")
                        }

                        if let message = auth.errorMessage {
                            Text(message)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("authErrorMessage")
                        }
                    }
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: proxy.size.height)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 32)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .background(Color.white.ignoresSafeArea())
        .ignoresSafeArea(.container, edges: .all)
        .preferredColorScheme(.light)
    }
}
