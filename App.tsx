import 'react-native-gesture-handler';
import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { store, persistor } from './src/store/store';
import { colors } from './src/theme';
import AppContainer from './src/components/app-container/AppContainer';
import ErrorBoundary from './src/components/shared/ErrorBoundary';

const LoadingFallback = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

// Session persistence (Consultant_Mobile fetchMe pattern): the persisted
// auth state rehydrates and AppContainer.bootstrapSession() re-validates it
// against GET /auth/me on cold start — the user signs in again only when
// the stored token is missing or no longer refreshable.
const App = () => (
  <ErrorBoundary>
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <PersistGate loading={<LoadingFallback />} persistor={persistor}>
          <AppContainer />
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default App;
