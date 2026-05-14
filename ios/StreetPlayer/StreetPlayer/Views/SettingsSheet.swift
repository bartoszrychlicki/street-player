import SwiftUI

struct SettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AuthViewModel
    @EnvironmentObject private var api: APIClient
    @EnvironmentObject private var store: LocalStore
    @EnvironmentObject private var recorder: LocationRecorder

    @AppStorage("StreetPlayerAPIBaseURL") private var apiBaseURL = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Email", value: auth.user?.email ?? "Unknown")
                    Button(role: .destructive) {
                        auth.signOut()
                        dismiss()
                    } label: {
                        Text("Sign out")
                    }
                    .accessibilityIdentifier("signOutButton")
                }

                Section("Location") {
                    Button("Request Always Location Permission") {
                        recorder.requestPermissionIfNeeded()
                    }
                    Text("Street Player records location in the background only while an active walk is running.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Server") {
                    TextField("API base URL", text: $apiBaseURL, prompt: Text(api.baseURL.absoluteString))
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    Text("Leave empty to use the bundled production URL from Info.plist.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Local data") {
                    LabeledContent("Pending walks", value: "\(store.pendingWalkCount)")
                    Button(role: .destructive) {
                        store.discardPendingWalks()
                    } label: {
                        Text("Discard pending walks")
                    }
                    .disabled(store.pendingWalkCount == 0)
                    .accessibilityIdentifier("discardPendingWalksButton")
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
