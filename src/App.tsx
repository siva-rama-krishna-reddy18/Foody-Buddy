import ChatContainer from './components/chat/ChatContainer';
import './App.css';

function App() {
  const customerId = '+1234567890';

  return (
    <div className="App">
      <ChatContainer customerId={customerId} />
    </div>
  );
}

export default App;