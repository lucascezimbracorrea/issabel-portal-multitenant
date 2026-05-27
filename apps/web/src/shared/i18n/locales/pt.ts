import navigation from './pt/navigation.json';
import callflow from './pt/callflow.json';
import auth from './pt/auth.json';
import common from './pt/common.json';
import extensionsForm from './pt/extensions-form.json';
import routing from './pt/routing.json';

export default { ...common, ...extensionsForm, ...auth, ...navigation, ...callflow, ...routing };
