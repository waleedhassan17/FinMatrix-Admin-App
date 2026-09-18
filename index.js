import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
// Side-effect import: registers the background location TaskManager task so the
// OS can deliver location updates even after a cold relaunch.
import './src/services/locationService';
import { installErrorMonitoring } from './src/services/errorMonitoring';
import App from './App';

// Report unhandled JS errors/rejections to the API (→ Sentry when configured).
installErrorMonitoring();

registerRootComponent(App);
