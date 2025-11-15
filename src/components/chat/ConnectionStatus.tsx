import React, { useEffect, useState } from 'react';
import { api } from '../services/api/ApiClient';

export default function ConnectionTest() {
  const [status, setStatus] = useState('Testing...');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const result = await api.testConnection();
      setStatus('✅ Connected');
      setData(result);
      setError(null);
    } catch (err: any) {
      setStatus('❌ Connection Failed');
      setError(err.message);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">
        Backend Status: <span className={status.includes('✅') ? 'text-green-600' : 'text-red-600'}>{status}</span>
      </h2>
      
      {data && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Backend Info:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mt-4">
          <strong>Error:</strong> {error}
          <p className="mt-2 text-sm">
            Make sure your backend is running at http://127.0.0.1:3000
          </p>
        </div>
      )}
      
      <button
        onClick={testConnection}
        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Test Again
      </button>
    </div>
  );
}