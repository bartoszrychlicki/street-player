import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var auth: AuthViewModel

    var body: some View {
        Group {
            if auth.isSignedIn {
                MapScreen()
            } else {
                LoginView()
            }
        }
        .background(Color.white.ignoresSafeArea())
    }
}
