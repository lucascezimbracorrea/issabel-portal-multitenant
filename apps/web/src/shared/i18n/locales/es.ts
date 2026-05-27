import navigation from './es/navigation.json';
import callflow from './es/callflow.json';
import auth from './es/auth.json';
import common from './es/common.json';
import extensionsForm from './es/extensions-form.json';
import routing from './es/routing.json';

export default { ...common, ...extensionsForm, ...auth, ...navigation, ...callflow, ...routing };
