<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { NInput, NButton, NSpace, NText, NForm, NFormItem, FormRules, FormInst, useMessage } from 'naive-ui';
import { useAuth } from '../composables/useAuth';

const emit = defineEmits<{
  success: []
  back: []
}>();

const { t } = useI18n();
const message = useMessage();
const { signInWithEmail, signUpWithEmail, resetPassword, updatePassword, signInWithOAuth, checkSession, isLoggedIn } = useAuth();

const authMode = ref<'login' | 'register' | 'reset' | 'updatePassword'>('login');
const formRef = ref<FormInst | null>(null);
const model = ref({
  email: '',
  password: '',
  confirmPassword: '',
  newPassword: ''
});
const isLoading = ref(false);
const isGoogleLoading = ref(false);

// Check URL parameter for password recovery mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('type') === 'recovery') {
  authMode.value = 'updatePassword';
} else if (urlParams.get('type') === 'signup') {
  // Email verification completed, check if user is logged in
  onMounted(async () => {
    await checkSession();
    if (isLoggedIn.value) {
      emit('success');
    }
  });
}

const emailRule = {
  required: true,
  message: t('options.settings.pleaseEnterEmail'),
  trigger: 'blur'
};

const passwordRule = {
  required: true,
  message: t('options.settings.pleaseEnterPassword'),
  trigger: 'blur'
};

const confirmPasswordRule = {
  required: true,
  message: t('options.settings.pleaseEnterConfirmPassword'),
  trigger: 'blur',
  validator: (_rule: any, value: string) => {
    if (value !== model.value.password) {
      return new Error(t('options.settings.passwordMismatch'));
    }
    return true;
  }
};

const newPasswordRule = {
  required: true,
  message: t('options.settings.pleaseEnterNewPassword'),
  trigger: 'blur'
};

const updatePasswordRules: FormRules = {
  password: newPasswordRule,
  confirmPassword: {
    required: true,
    message: t('options.settings.pleaseEnterConfirmPassword'),
    trigger: 'blur',
    validator: (_rule: any, value: string) => {
      if (value !== model.value.password) {
        return new Error(t('options.settings.passwordMismatch'));
      }
      return true;
    }
  }
};

const loginRules: FormRules = {
  email: emailRule,
  password: passwordRule
};

const registerRules: FormRules = {
  email: emailRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule
};

const resetRules: FormRules = {
  email: emailRule
};

async function handleEmailLogin() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  isLoading.value = true;
  const result = await signInWithEmail(model.value.email, model.value.password);
  isLoading.value = false;

  if (result.success) {
    message.success(t('options.settings.loginSuccess'));
    emit('success');
  } else {
    message.error(result.error || t('options.settings.loginFailed'));
  }
}

async function handleRegister() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  isLoading.value = true;
  const result = await signUpWithEmail(model.value.email, model.value.password);
  isLoading.value = false;

  if (result.success) {
    if (result.needEmailConfirmation) {
      message.info(t('options.settings.emailConfirmationSent'));
      authMode.value = 'login';
    } else {
      message.success(t('options.settings.registerSuccess'));
      emit('success');
    }
    model.value = { email: '', password: '', confirmPassword: '', newPassword: '' };
  } else {
    message.error(result.error || t('options.settings.registerFailed'));
  }
}

async function handleResetPassword() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  isLoading.value = true;
  const result = await resetPassword(model.value.email);
  isLoading.value = false;

  if (result.success) {
    message.success(t('options.settings.resetPasswordSuccess'));
    authMode.value = 'login';
    model.value = { email: '', password: '', confirmPassword: '', newPassword: '' };
  } else {
    message.error(result.error || t('options.settings.resetPasswordFailed'));
  }
}

async function handleGoogleLogin() {
  isGoogleLoading.value = true;
  try {
    const result = await signInWithOAuth('google') as { success: boolean; error?: string };
    if (!result.success) {
      message.error(result.error || t('options.settings.loginFailed'));
    } else {
      message.success(t('options.settings.loginSuccess'));
      emit('success');
    }
  } finally {
    isGoogleLoading.value = false;
  }
}

async function handleUpdatePassword() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  isLoading.value = true;
  const result = await updatePassword(model.value.password);
  isLoading.value = false;

  if (result.success) {
    message.success(t('options.settings.updatePasswordSuccess'));
    authMode.value = 'login';
    model.value = { email: '', password: '', confirmPassword: '', newPassword: '' };
  } else {
    message.error(result.error || t('options.settings.updatePasswordFailed'));
  }
}

function getFormRules(): FormRules {
  switch (authMode.value) {
    case 'login': return loginRules;
    case 'register': return registerRules;
    case 'reset': return resetRules;
    case 'updatePassword': return updatePasswordRules;
    default: return loginRules;
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-form">
      <h2 class="login-title">{{ authMode === 'updatePassword' ? t('options.settings.updatePasswordTitle') : t('options.settings.syncTitle') }}</h2>
      <NText depth="3" style="font-size: 14px; text-align: center; display: block; margin-bottom: 24px">
        {{ authMode === 'updatePassword' ? '' : t('options.settings.syncDesc') }}
      </NText>

      <NForm
        ref="formRef"
        :model="model"
        :rules="getFormRules()"
        size="large"
        :disabled="isLoading"
      >
        <NFormItem
          v-if="authMode !== 'updatePassword'"
          path="email"
          :label="t('options.settings.email')"
        >
          <NInput
            v-model:value="model.email"
            :placeholder="t('options.settings.email')"
            :disabled="isLoading"
          />
        </NFormItem>
        <NFormItem
          v-if="authMode === 'login' || authMode === 'register' || authMode === 'updatePassword'"
          path="password"
          :label="authMode === 'updatePassword' ? t('options.settings.newPassword') : t('options.settings.password')"
        >
          <NInput
            v-model:value="model.password"
            type="password"
            show-password-on="click"
            :placeholder="authMode === 'updatePassword' ? t('options.settings.newPassword') : t('options.settings.password')"
            :disabled="isLoading"
          />
        </NFormItem>
        <NFormItem
          v-if="authMode === 'register' || authMode === 'updatePassword'"
          path="confirmPassword"
          :label="t('options.settings.confirmPassword')"
        >
          <NInput
            v-model:value="model.confirmPassword"
            type="password"
            show-password-on="click"
            :placeholder="t('options.settings.confirmPassword')"
            :disabled="isLoading"
          />
        </NFormItem>

        <NSpace vertical :size="16" style="margin-top: 8px">
          <NButton
            v-if="authMode === 'login'"
            type="primary"
            @click="handleEmailLogin"
            :loading="isLoading"
            block
          >
            {{ t('options.settings.loginBtn') }}
          </NButton>
          <NButton
            v-if="authMode === 'register'"
            type="primary"
            @click="handleRegister"
            :loading="isLoading"
            block
          >
            {{ t('options.settings.registerBtn') }}
          </NButton>
          <NButton
            v-if="authMode === 'reset'"
            type="primary"
            @click="handleResetPassword"
            :loading="isLoading"
            block
          >
            {{ t('options.settings.resetPasswordBtn') }}
          </NButton>
          <NButton
            v-if="authMode === 'updatePassword'"
            type="primary"
            @click="handleUpdatePassword"
            :loading="isLoading"
            block
          >
            {{ t('options.settings.updatePasswordBtn') }}
          </NButton>
          <NButton
            v-if="authMode === 'login'"
            @click="handleGoogleLogin"
            :loading="isGoogleLoading"
            block
          >
            <template #icon>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.875 2.683-6.614Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.181l-2.909-2.258c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9 9 0 0 0 0 9c0 1.452.347 2.827.957 4.042l3.007-2.332Z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.44 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
              </svg>
            </template>
            {{ t('options.settings.googleLoginBtn') }}
          </NButton>
          <NButton
            @click="emit('back')"
            block
          >
            {{ t('common.back') }}
          </NButton>
        </NSpace>
      </NForm>

      <div class="auth-links">
        <NText
          v-if="authMode === 'login'"
          depth="3"
          style="font-size: 14px; cursor: pointer"
          @click="authMode = 'register'"
        >
          {{ t('options.settings.noAccount') }}
        </NText>
        <NText
          v-if="authMode === 'register'"
          depth="3"
          style="font-size: 14px; cursor: pointer"
          @click="authMode = 'login'"
        >
          {{ t('options.settings.hasAccount') }}
        </NText>
        <NText
          v-if="authMode === 'login'"
          depth="3"
          style="font-size: 14px; cursor: pointer"
          @click="authMode = 'reset'"
        >
          {{ t('options.settings.forgotPassword') }}
        </NText>
        <NText
          v-if="authMode === 'reset'"
          depth="3"
          style="font-size: 14px; cursor: pointer"
          @click="authMode = 'login'"
        >
          {{ t('options.settings.backToLogin') }}
        </NText>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.login-form {
  width: 100%;
  max-width: 400px;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px 0;
  text-align: center;
  color: #1a1a2e;
}

.auth-links {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  gap: 24px;
}

.auth-links .n-text:hover {
  color: #4361ee;
}
</style>

<style>
/* Dark mode styles (unscoped so html.dark ancestor selector works) */
html.dark .login-title {
  color: #fff !important;
}
</style>
