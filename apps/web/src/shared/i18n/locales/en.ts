import navigation from './en/navigation.json';
import callflow from './en/callflow.json';
import auth from './en/auth.json';
import common from './en/common.json';
import extensionsForm from './en/extensions-form.json';

export default { ...common, ...extensionsForm, ...auth, ...navigation, ...callflow };
