import Auth from './components/Auth';

export default function App() {
  return (
    <div style={{ padding: '40px 16px', background: '#F8FAFC', minHeight: '100vh' }}>
      <Auth onAuthenticated={(session) => console.log('Signed in:', session)} />
    </div>
  );
}
