'use client';
import { LegalLinks } from '@/features/legal/components/legal-links';
import { useEffect, useRef, useState } from 'react';
import { FiUser, FiMail, FiLock, FiHash } from 'react-icons/fi';
import type { PublicUser } from '@/features/auth/auth.contracts';
import { AuthField } from '@/features/auth/components/auth-field';
import { Button } from '@/components/ui/button';
import { Modal } from '@/features/events/components/modal';
import { accountRequest } from '../account.service';
import { parseProfile } from '../account.contracts';
import type { AccountProfile } from '../account.contracts';
import styles from './account.module.css';

export function PreferencesPanel({
  user,
  refresh,
}: {
  user: PublicUser;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<AccountProfile>();
  const [firstName, setFirstName] = useState(user.firstName),
    [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(''),
    [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [challengeId, setChallengeId] = useState(''),
    [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0),
    [remaining, setRemaining] = useState(0);
  const [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<
    Record<string, { text: string; error: boolean }>
  >({});
  const pending = useRef(false);
  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
  }, [user.firstName, user.lastName]);
  useEffect(() => {
    void accountRequest('preferences')
      .then((data) => setProfile(parseProfile(data)))
      .catch((error) =>
        setNotices((previous) => ({
          ...previous,
          profile: {
            text:
              error instanceof Error
                ? error.message
                : 'Falha ao carregar Preferências.',
            error: true,
          },
        })),
      );
  }, []);
  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  function notice(section: string) {
    const item = notices[section];
    return item ? (
      <p className={styles.notice} role={item.error ? 'alert' : 'status'}>
        {item.text}
      </p>
    ) : null;
  }
  async function run(section: string, action: () => Promise<string>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotices((previous) => ({
      ...previous,
      [section]: { text: 'Processando...', error: false },
    }));
    try {
      const text = await action();
      setNotices((previous) => ({
        ...previous,
        [section]: { text, error: false },
      }));
    } catch (error) {
      setNotices((previous) => ({
        ...previous,
        [section]: {
          text:
            error instanceof Error
              ? error.message
              : 'Não foi possível concluir.',
          error: true,
        },
      }));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function field(
    id: string,
    label: string,
    value: string,
    change: (value: string) => void,
    type: 'text' | 'email' | 'password',
    autoComplete:
      | 'given-name'
      | 'family-name'
      | 'email'
      | 'current-password'
      | 'new-password'
      | 'one-time-code',
  ) {
    return (
      <AuthField
        id={id}
        name={id}
        label={label}
        placeholder={label}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={change}
        disabled={busy}
        error={undefined}
        inputRef={null}
        icon={
          type === 'password'
            ? FiLock
            : type === 'email'
              ? FiMail
              : autoComplete === 'one-time-code'
                ? FiHash
                : FiUser
        }
        maxLength={
          type === 'password'
            ? 1024
            : autoComplete === 'one-time-code'
              ? 8
              : type === 'email'
                ? 254
                : 100
        }
        inputMode={autoComplete === 'one-time-code' ? 'numeric' : undefined}
      />
    );
  }
  async function exit(message: string) {
    setEmailPassword('');
    setCurrentPassword('');
    setPassword('');
    setConfirmation('');
    setCode('');
    setChallengeId('');
    // /auth/me remains the identity source, including after global revocation.
    const notice = message.startsWith('E-mail')
      ? 'email-changed'
      : message.startsWith('Senha')
        ? 'password-changed'
        : 'account-deleted';
    window.location.replace(`/?notice=${notice}`);
    return message;
  }
  const restricted = profile?.localCredentials !== true;
  return (
    <div className={styles.content} aria-busy={busy}>
      <section className={styles.section} aria-labelledby="personal-heading">
        <h2 id="personal-heading">Dados pessoais</h2>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void run('names', async () => {
              await accountRequest('preferences/names', {
                firstName,
                lastName,
              });
              await refresh();
              return 'Dados pessoais atualizados.';
            });
          }}
        >
          {field(
            'firstName',
            'Nome',
            firstName,
            setFirstName,
            'text',
            'given-name',
          )}
          {field(
            'lastName',
            'Sobrenome',
            lastName,
            setLastName,
            'text',
            'family-name',
          )}
          <Button type="submit" disabled={busy}>
            Salvar dados pessoais
          </Button>
          {notice('names')}
        </form>
      </section>
      {notice('profile')}
      {notices.profile?.error && (
        <Button
          disabled={busy}
          onClick={() =>
            void run('profile', async () => {
              setProfile(parseProfile(await accountRequest('preferences')));
              return 'Opções da conta carregadas.';
            })
          }
        >
          Tentar novamente
        </Button>
      )}
      {!profile && !notices.profile && (
        <p role="status">Carregando opções da conta...</p>
      )}
      <section className={styles.section} aria-labelledby="email-heading">
        <h2 id="email-heading">E-mail</h2>
        <p>E-mail atual: {user.email}</p>
        {restricted ? (
          <p>
            {profile?.googleLinked
              ? 'O e-mail não pode ser alterado porque esta conta está vinculada ao Google.'
              : 'A alteração de e-mail requer uma conta local sem vínculo com o Google.'}
          </p>
        ) : (
          <>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void run('email', async () => {
                  const data = await accountRequest(
                    'preferences/email/request',
                    { email, currentPassword: emailPassword },
                  );
                  if (typeof data.challengeId !== 'string')
                    throw new Error('Resposta inválida do servidor.');
                  setChallengeId(data.challengeId);
                  setCode('');
                  setResendAt(Date.now() + 60000);
                  setEmailPassword('');
                  return 'Código solicitado ao novo endereço. Seu e-mail atual permanece válido até a confirmação. O código expira em 10 minutos.';
                });
              }}
            >
              {field(
                'new-email',
                'Novo e-mail',
                email,
                setEmail,
                'email',
                'email',
              )}
              {field(
                'email-password',
                'Senha atual',
                emailPassword,
                setEmailPassword,
                'password',
                'current-password',
              )}
              <Button type="submit" disabled={busy || remaining > 0}>
                {challengeId ? 'Reenviar código' : 'Enviar código'}
              </Button>
              {remaining > 0 && (
                <p role="status">Reenvio disponível em {remaining}s.</p>
              )}
            </form>
            {challengeId && (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run('email', async () => {
                    const data = await accountRequest(
                      'preferences/email/confirm',
                      { challengeId, code },
                    );
                    return exit(
                      typeof data.message === 'string'
                        ? data.message
                        : 'E-mail alterado. Entre novamente.',
                    );
                  });
                }}
              >
                {field(
                  'email-code',
                  'Código de 8 dígitos',
                  code,
                  setCode,
                  'text',
                  'one-time-code',
                )}
                <Button type="submit" disabled={busy}>
                  Confirmar novo e-mail
                </Button>
              </form>
            )}
          </>
        )}
        {notice('email')}
      </section>
      <section className={styles.section} aria-labelledby="password-heading">
        <h2 id="password-heading">Senha</h2>
        {restricted ? (
          <p>
            {profile?.googleLinked
              ? 'A senha não pode ser alterada porque esta conta está vinculada ao Google.'
              : 'A alteração de senha requer uma conta local sem vínculo com o Google.'}
          </p>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void run('password', async () => {
                if (password !== confirmation)
                  throw new Error('A confirmação da senha não confere.');
                await accountRequest('preferences/password', {
                  currentPassword,
                  password,
                  confirmation,
                });
                return exit('Senha alterada. Entre novamente.');
              });
            }}
          >
            {field(
              'current-password',
              'Senha atual',
              currentPassword,
              setCurrentPassword,
              'password',
              'current-password',
            )}
            {field(
              'new-password',
              'Nova senha',
              password,
              setPassword,
              'password',
              'new-password',
            )}
            {field(
              'confirmation',
              'Confirmar nova senha',
              confirmation,
              setConfirmation,
              'password',
              'new-password',
            )}
            <p>
              Use pelo menos 12 caracteres e no máximo 1024 bytes. A alteração
              encerra todas as sessões.
            </p>
            <Button type="submit" disabled={busy}>
              Salvar nova senha
            </Button>
            {notice('password')}
          </form>
        )}
      </section>
      <section className={styles.section} aria-labelledby="delete-heading">
        <h2 id="delete-heading">Excluir conta</h2>
        <p>Remova sua conta e seus dados pessoais de forma definitiva.</p>
        <Button
          className={styles.danger}
          disabled={busy}
          onClick={() => {
            setNotices((previous) => ({
              ...previous,
              delete: { text: '', error: false },
            }));
            setDeleting(true);
          }}
        >
          Excluir minha conta
        </Button>
      </section>
      <LegalLinks />
      {deleting && (
        <Modal
          title="Excluir conta"
          busy={busy}
          onClose={() => setDeleting(false)}
        >
          <p>
            Tem certeza de que deseja excluir sua conta? Você perderá o acesso,
            seus dados pessoais serão removidos e você deixará de aparecer nos
            rankings. Esta ação não pode ser desfeita.
          </p>
          {notice('delete')}
          <div className={styles.actions}>
            <Button disabled={busy} onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button
              className={styles.danger}
              disabled={busy}
              onClick={() =>
                void run('delete', async () => {
                  await accountRequest('preferences/delete', {
                    confirmed: true,
                  });
                  return exit('Conta excluída.');
                })
              }
            >
              {busy ? 'Excluindo...' : 'Excluir conta'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
