import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function OrderCheckout() {
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([
          { 
            customer_name: customerName || 'לקוח אנונימי', 
            total_amount: Number(amount) || 0,
            status: 'paid' 
          }
        ])
        .select();

      if (error) throw error;

      setIsSuccess(true);
    } catch (err) {
      console.error('Error saving order:', err.message);
      setErrorMessage('אירעה שגיאה בשמירת ההזמנה. בדקי את החיבור ונסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
        <h2>הזמנתך נקלטה במערכת בהצלחה!</h2>
        <button 
          onClick={() => {
            setIsSuccess(false);
            setCustomerName('');
            setAmount('');
          }}
          style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
        >
          ביצוע הזמנה נוספת
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', textAlign: 'right' }} dir="rtl">
      <h2>סימולציית תשלום והזמנה</h2>
      <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>שם הלקוח:</label>
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)} 
            placeholder="הקלדי את שמך..."
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>סכום לתשלום (₪):</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            placeholder="150"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

        <button 
          type="submit" 
          disabled={isLoading}
          style={{ padding: '12px', backgroundColor: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {isLoading ? 'מעבד ושומר...' : 'אישור תשלום ושמירה'}
        </button>
      </form>
    </div>
  );
}