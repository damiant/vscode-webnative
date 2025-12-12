/**
 * Returns the HTML content for the What's New page
 * This function contains all the content and structure for the What's New page
 */
export function getWhatsNewContent(): string {
  return `
    <div class="container">
        <h1>What's New in WebNative</h1>
        
        <div class="section">
            <p>Welcome to the latest version of WebNative! We've added some exciting new features and improvements to help you build better web and native applications.</p>
        </div>

        <h2>New Features</h2>
        
        <div class="feature-grid">
            <div class="feature-card" onclick="document.getElementById('capacitor-8-section').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;">
                <h3>Capacitor 8!</h3>
                <p>Upgrade Capacitor 7 projects to Capacitor 8 with the migration assistant.</p>
            </div>
            
            <div class="feature-card" onclick="document.getElementById('donate-section').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;">
                <h3>Donate to Support WebNative</h3>
                <p>Help keep WebNative maintained and growing with your support.</p>
            </div>
            
            <div class="feature-card" onclick="document.getElementById('angular-21-section').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;">
                <h3>Angular 21 Migration</h3>
                <p>Upgrade Angular 20 projects to Angular 21 with automated migration support.</p>
            </div>
            
            <div class="feature-card" onclick="document.getElementById('spm-migration-section').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;">
                <h3>Swift Package Manager Migration</h3>
                <p>Migrate iOS projects from CocoaPods to Swift Package Manager (SPM) with one click.</p>
            </div>
            
            <div class="feature-card" onclick="document.getElementById('ai-assistance-section').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;">
                <h3>AI Assistance</h3>
                <p>Let AI automatically fix build errors in your web and native projects.</p>
            </div>
        </div>

        <div class="section" id="capacitor-8-section">
            <h2>Capacitor 8 Migration Details</h2>
            
            <h3>Key Updates</h3>
            
            <ul>
            <li>New iOS projects now use SPM instead of CocoaPods. Existing CocoaPods projects continue working as the iOS ecosystem transitions to SPM. <a href="https://ionic.io/blog/swift-package-manager-and-capacitor">Learn more</a></li>
            <li>Automatic handling of status and navigation bars through the new <a href="https://capacitorjs.com/docs/apis/system-bars">SystemBars API</a>, providing immersive layouts that adapt to modern Android devices.</li>
            </ul>
            <h3>Requirements</h3>
            <ul>
                <li><strong>Node.js 22+</strong> (LTS recommended)</li>
                <li><strong>iOS:</strong> Xcode 26.0+, iOS 15.0+ deployment target</li>
                <li><strong>Android:</strong> Studio Otter 2025.2.1+, SDK 24+, Target SDK 36</li>
                <li><strong>Gradle 8.14.3</strong> with plugin 8.13.0, Kotlin 2.2.20</li>
            </ul>
            
            <h3>Notable Changes</h3>
            <ul>
                <li><code>android.adjustMarginsForEdgeToEdge</code> removed—use SystemBars and CSS <code>env</code> variables</li>
                <li><code>bridge_layout_main.xml</code> renamed to <code>capacitor_bridge_layout_main.xml</code></li>
                <li><code>density</code> added to Android <code>configChanges</code> to prevent webView reloads</li>
                <li>Geolocation <code>timeout</code> now applies to all platforms consistently</li>
                <li>Orientation locking disabled on tablets (Android 16+) for better adaptive layouts</li>
            </ul>
            
            <h3>Migration Process</h3>
            
            <h4>Using the Extension</h4>
            <p>The easiest way to migrate is using the extension. An option <b>Migrate to Capacitor 8</b> will appear for Capacitor 7 projects.</p>
            <p>You can also use the Capacitor CLI directly with <code>npm i -D @capacitor/cli@latest</code> then <code>npx cap migrate</code></p>

            <h4>Additional Resources</h4>
            <ul>
                <li><a href="https://ionic.io/blog/announcing-capacitor-8">Capacitor 8 Announcement Blog Post</a></li>
                <li><a href="https://capacitorjs.com/docs/updating/8-0">Official Capacitor 8 Update Guide</a></li>
                <li><a href="https://capacitorjs.com/docs/apis/system-bars">System Bars API Documentation</a></li>
            </ul>
        </div>

        <div class="section" id="angular-21-section">
            <h2>Angular 21</h2>
            
            <h3>Features in Angular 21</h3>
            
            <ul>
                <li><strong>Signal Forms (Experimental)</strong><br/>A brand-new, signal-based reactive forms system with automatic syncing, built-in schema validation, and no need for ControlValueAccessor.</li>
                <li><strong>Angular Aria (Developer Preview)</strong><br/>A new library of accessible, unstyled, headless components (13 components across 8 patterns) that you can fully customize.</li>
                <li><strong>MCP Server Now Stable</strong><br/> AI agents can interact with Angular through tools for best practices, documentation search, examples, migrations, and an interactive AI tutor.</li>
                <li><strong>Vitest Is the Default Test Runner</strong><br/>Vitest replaces Karma for new projects, is stable and fully integrated, with migration tooling available.</li>
                <li><strong>Zone.js Removed by Default</strong><br/> New Angular apps are now zoneless by default, delivering better performance, smaller bundles, and more predictable change detection.</li>
                <li><strong>Major Documentation Overhaul</strong><br/>New landing page, new Signals tutorial, revamped routing and DI guides, Material theming guide, and Tailwind CSS integration.</li>
                <li><strong>AI-Focused Development Resources</strong><br/>A new angular.dev/ai hub with AI best practices, patterns, and prompt guidelines for AI-assisted Angular development.</li>
                <li><strong>Improved Tooling for Modern Patterns</strong><br/>MCP tools can help migrate to onPush + zoneless, find examples, update code, and keep AI agents aligned with newest Angular features.</li>
                <li><strong>Template & Developer Experience Enhancements</strong><br/>RegExp allowed directly in templates, built-in Signals formatter in devtools, generic SimpleChanges for better type safety, and improved CLDR support (currency, dates).</li>
                <li><strong>UI & CDK Improvements</strong><br/>CDK overlays now use native popovers, Material utility classes for design tokens, new animation APIs, drag-and-drop enhancements, and DevTools improvements (route & signal graph).</li>
            </ul>
            
            <h3>Migration Process</h3>
            
            <h4>Using the Extension</h4>
            <p>The easiest way to migrate is using the extension. An option <b>Migrate to Angular 21</b> will automatically appear for Angular 20 projects.</p>
            <p>You can also use the Angular CLI directly with <code>ng update @angular/cli@21 @angular/core@21</code></p>
                       
            <h4>Additional Resources</h4>
            <ul>
                <li><a href="https://blog.angular.dev/announcing-angular-v21-57946c34f14b">Angular 21 Announcement Blog Post</a></li>
                <li><a href="https://angular.dev/update-guide">Official Angular Update Guide</a></li>
                <li><a href="https://angular.dev">Angular Documentation</a></li>
            </ul>
        </div>

        <div class="section" id="spm-migration-section">
            <h2>Swift Package Manager Migration</h2>
            
            <h3>Why Migrate to SPM?</h3>
            
            <p>CocoaPods, the iOS package manager since 2011, announced maintenance mode in August 2024 and will become read-only on December 2, 2026. Swift Package Manager (SPM), released by Apple in 2015, is now the recommended dependency manager for iOS projects.</p>
            
            <h3>Benefits</h3>
            
            <ul>
                <li><strong>Official Apple Support:</strong> SPM is built and maintained by Apple as the native package manager for Swift</li>
                <li><strong>Future-Proof:</strong> All Ionic-maintained Capacitor plugins support SPM and will continue to receive updates</li>
                <li><strong>Simpler Setup:</strong> No Ruby dependencies or external tools required—built directly into Xcode</li>
                <li><strong>Better Integration:</strong> Seamless integration with Xcode and the Swift toolchain</li>
                <li><strong>Default for New Projects:</strong> Capacitor 8 creates new iOS projects with SPM by default</li>
            </ul>
            
            <h3>Considerations</h3>
            
            <ul>
                <li>You cannot mix SPM and CocoaPods in the same project—it's one or the other</li>
                <li>All Ionic-maintained Capacitor plugins support SPM</li>
                <li>Third-party plugins must be updated to support SPM before they can be used</li>
                <li>Cordova plugin support may be limited and require additional configuration</li>
            </ul>
            
            <h3>Migration Process</h3>
            
            <h4>Using the Extension</h4>
            <p>The easiest way to migrate is using the extension. For existing iOS projects using CocoaPods, a <b>SPM Migration</b> option will appear in the recommendations panel.</p>
            <p>You can also use the Capacitor CLI directly with <code>npx cap spm-migration-assistant</code></p>
            
            <h4>What the Migration Does</h4>
            <ul>
                <li>Backs up your existing Podfile and iOS project configuration</li>
                <li>Removes CocoaPods dependencies and files</li>
                <li>Configures your Xcode project to use Swift Package Manager</li>
                <li>Adds all compatible Capacitor plugins as SPM packages</li>
                <li>Updates project settings for SPM compatibility</li>
            </ul>
            
            <h4>Additional Resources</h4>
            <ul>
                <li><a href="https://ionic.io/blog/swift-package-manager-and-capacitor">Swift Package Manager and Capacitor Blog Post</a></li>
                <li><a href="https://capacitorjs.com/docs/ios/spm">Using SPM in Capacitor Documentation</a></li>
                <li><a href="https://capacitorjs.com/docs/ios/spm#using-spm-in-an-existing-capacitor-project">SPM Migration Guide</a></li>
            </ul>
        </div>

        <div class="section" id="donate-section">
            <h2>Support WebNative</h2>
            
            <img src="https://webnative.dev/_astro/profile.a-yy9BdW.jpg" alt="Damian Tarnawsky" style="float: right; width: 120px; height: 120px; border-radius: 50%; margin: 0 1.5rem 1rem 0; object-fit: cover;">
            
            <p>Hi, I'm Damian, the creator of the WebNative extension (formerly the Ionic extension). I built this project out of passion while I was at Ionic and continue to maintain it because I love Capacitor and the web ecosystem.</p>
            
            <p>If this extension has helped you, please consider supporting its development—your one-time or monthly donation keeps it maintained, funds new features, and helps it continue to grow.</p>
            
            <p>Thank you, and happy coding!</p>
            
            <div style="margin-top: 1.5rem; clear: both;">
                <button class="button" data-url="https://github.com/sponsors/damiant">
                    Donate to the Project
                </button>
            </div>
        </div>

        <div class="section" id="ai-assistance-section">
            <h2>AI Assistance for Build Errors</h2>
            
            <h3>Intelligent Error Resolution</h3>
            
            <p>WebNative now includes AI-powered assistance to help you quickly resolve build errors in your web and native projects. When errors occur during builds, the extension can automatically extract error details and provide intelligent fixes.</p>
            
            <h3>How It Works</h3>
            
            <ul>
                <li><strong>Automatic Error Detection:</strong> WebNative monitors your build output for errors in web builds, iOS builds, and Android builds</li>
                <li><strong>One-Click Fix:</strong> When an error is detected, a "Fix Issue" option appears that leverages your IDE's AI agent (like GitHub Copilot)</li>
                <li><strong>Context-Aware Solutions:</strong> The AI agent receives the full error context, including stack traces, file paths, and relevant code</li>
                <li><strong>Multi-Platform Support:</strong> Works with errors from npm/yarn/pnpm builds, Xcode builds, and Gradle/Android Studio builds</li>
            </ul>
            
            <h3>Supported Error Types</h3>
            
            <ul>
                <li><strong>TypeScript/JavaScript Errors:</strong> Type errors, import issues, syntax errors</li>
                <li><strong>iOS Build Errors:</strong> Swift compilation errors, missing frameworks, provisioning issues</li>
                <li><strong>Android Build Errors:</strong> Gradle configuration problems, dependency conflicts, SDK version mismatches</li>
                <li><strong>Plugin Errors:</strong> Capacitor plugin compatibility issues, missing dependencies</li>
                <li><strong>Configuration Errors:</strong> Invalid capacitor.config.ts, angular.json, or package.json settings</li>
            </ul>
            
            <h3>Getting Started</h3>
            
            <ol>
                <li>Ensure you have an AI agent extension installed (e.g., GitHub Copilot)</li>
                <li>Run a build command through WebNative (Build, Run, or Sync)</li>
                <li>If an error occurs, look for the "Fix Issue" option in the error notification or output panel</li>
                <li>Click "Fix Issue" to let the AI agent analyze and suggest fixes</li>
                <li>Review and apply the AI's suggested solution</li>
            </ol>
        </div>
        <div class="section">
            <h2>Resources</h2>
            <p>Learn more about WebNative and get help:</p>
            
            <div>
            <button class="button" data-url="https://github.com/ionic-team/vscode-webnative">
                View on GitHub
            </button>
            <button class="button button-secondary" data-url="https://webnative.dev/introduction/new-project/">
                Read Documentation
            </button>
            <button class="button button-secondary" data-url="https://github.com/damiant/vscode-webnative/issues/new">
                Report an Issue
            </button>
            </div>
        </div>

        <hr>

        <div class="section">
            <h2>Suggest a Feature</h2>
            <p>We are actively looking for feature requests for things that you find difficult with web and native development. Suggest a feature today!</p>
            <div style="margin-top: 1rem;">
                <button class="button" data-url="https://github.com/damiant/vscode-webnative/issues/new">
                    Suggest a Feature
                </button>
            </div>
        </div>

        <hr>

        <div class="section">
            <p style="text-align: center; color: var(--vscode-descriptionForeground);">
                Thank you for using WebNative! <span class="badge">v2.1.0</span>
            </p>
        </div>
    </div>
    `;
}

/**
 * Alternative example showing how to use local video files
 * Uncomment and modify this section if you want to use local videos instead of YouTube
 */
export function getVideoExample(): string {
  return `
    <div class="video-container">
        <video controls>
            <source src="https://example.com/path/to/your/video.mp4" type="video/mp4">
            <source src="https://example.com/path/to/your/video.webm" type="video/webm">
            Your browser does not support the video tag.
        </video>
    </div>
    `;
}

/**
 * Example of creating a custom section with images
 */
export function getImageExample(): string {
  return `
    <h2>📸 Screenshots</h2>
    <p>See the new features in action:</p>
    <img src="https://example.com/screenshot1.png" alt="Feature Screenshot">
    `;
}
