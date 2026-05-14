import XCTest

final class StreetPlayerUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
    }

    func testEmailCreateOrSignInReachesMap() throws {
        let email = ProcessInfo.processInfo.environment["SP_TEST_EMAIL"] ?? "streetplayer-ui-\(UUID().uuidString)@example.com"
        let password = ProcessInfo.processInfo.environment["SP_TEST_PASSWORD"] ?? "StreetPlayer123!"

        app.launch()
        signOutIfNeeded()
        XCTAssertTrue(app.textFields["emailField"].waitForExistence(timeout: 20), app.debugDescription)

        enterEmailCredentials(email: email, password: password)
        app.buttons["toggleEmailModeButton"].tap()
        app.buttons["emailAuthButton"].tap()

        if !app.buttons["startWalkButton"].waitForExistence(timeout: 25),
           app.staticTexts["authErrorMessage"].exists,
           app.staticTexts["authErrorMessage"].label.localizedCaseInsensitiveContains("already in use") {
            app.buttons["toggleEmailModeButton"].tap()
            app.buttons["emailAuthButton"].tap()
        }

        XCTAssertTrue(app.buttons["startWalkButton"].waitForExistence(timeout: 30), app.debugDescription)
    }

    func testGoogleSignInStartsOrReportsConfiguration() throws {
        app.launch()
        signOutIfNeeded()
        XCTAssertTrue(app.buttons["googleSignInButton"].waitForExistence(timeout: 20), app.debugDescription)

        app.buttons["googleSignInButton"].tap()

        let authError = app.staticTexts["authErrorMessage"]
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        let googleText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Google")).firstMatch

        let reachedGoogleSurface = authError.waitForExistence(timeout: 8)
            || safari.wait(for: .runningForeground, timeout: 8)
            || googleText.waitForExistence(timeout: 8)

        XCTAssertTrue(reachedGoogleSurface, app.debugDescription)
    }

    func testStartWalkTransitionsToRecording() throws {
        app.launch()
        signInIfNeeded()

        let startButton = app.buttons["startWalkButton"]
        XCTAssertTrue(startButton.waitForExistence(timeout: 30), app.debugDescription)
        startButton.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        let finishButton = app.buttons["finishWalkButton"]
        XCTAssertTrue(finishButton.waitForExistence(timeout: 10), app.debugDescription)
        finishButton.tap()
    }

    func testDiscardPendingWalksControlExists() throws {
        app.launch()
        signInIfNeeded()

        app.buttons["settingsButton"].tap()
        let discardButton = app.buttons["discardPendingWalksButton"]
        XCTAssertTrue(discardButton.waitForExistence(timeout: 10), app.debugDescription)
        if discardButton.isEnabled {
            discardButton.tap()
        }
    }

    func testCenterOnUserControlExists() throws {
        app.launch()
        signInIfNeeded()

        XCTAssertTrue(app.buttons["centerOnUserButton"].waitForExistence(timeout: 10), app.debugDescription)
    }

    func testTopToolbarControlsExist() throws {
        app.launch()
        signInIfNeeded()

        XCTAssertTrue(app.buttons["historyButton"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["topBarTitle"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["settingsButton"].waitForExistence(timeout: 10), app.debugDescription)
    }

    private func enterEmailCredentials(email: String, password: String) {
        let emailField = app.textFields["emailField"]
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["passwordField"]
        passwordField.tap()
        passwordField.typeText(password)
    }

    private func signOutIfNeeded() {
        guard app.buttons["startWalkButton"].waitForExistence(timeout: 5) else { return }
        app.buttons["settingsButton"].tap()
        let signOutButton = app.buttons["signOutButton"]
        XCTAssertTrue(signOutButton.waitForExistence(timeout: 10), app.debugDescription)
        signOutButton.tap()
    }

    private func signInIfNeeded() {
        if app.buttons["startWalkButton"].waitForExistence(timeout: 5) { return }

        let email = "streetplayer-ui-\(UUID().uuidString)@example.com"
        let password = "StreetPlayer123!"
        XCTAssertTrue(app.textFields["emailField"].waitForExistence(timeout: 20), app.debugDescription)
        enterEmailCredentials(email: email, password: password)
        app.buttons["toggleEmailModeButton"].tap()
        app.buttons["emailAuthButton"].tap()
        XCTAssertTrue(app.buttons["startWalkButton"].waitForExistence(timeout: 30), app.debugDescription)
    }

}
