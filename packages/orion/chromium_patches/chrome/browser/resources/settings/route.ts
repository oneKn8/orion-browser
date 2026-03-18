diff --git a/chrome/browser/resources/settings/route.ts b/chrome/browser/resources/settings/route.ts
index a116759bfcca4..270945c27b3c4 100644
--- a/chrome/browser/resources/settings/route.ts
+++ b/chrome/browser/resources/settings/route.ts
@@ -165,6 +165,7 @@ function createRoutes(): SettingsRoutes {
 
   // Root page.
   r.BASIC = new Route('/');
+  r.ORION_PREFS = new Route('/orion-settings', 'Orion Settings');
 
   r.ABOUT = r.BASIC.createSection(
       '/help', 'about', loadTimeData.getString('aboutPageTitle'));
