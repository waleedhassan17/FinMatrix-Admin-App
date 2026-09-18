import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
// No locationService import here. The tenant app registers a background
// location TaskManager task at startup for the rider portal; the platform
// console has no riders, and that side effect is the sole reason
// expo-location and expo-task-manager were dependencies at all.
import { installErrorMonitoring } from './src/services/errorMonitoring';
import App from './App';

// Report unhandled JS errors/rejections to the API (→ Sentry when configured).
installErrorMonitoring();

registerRootComponent(App);
