import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const token = jwt.sign({ username: 'admin', userId: 1, role: 'ADMIN' }, process.env.JWT_SECRET || 'fallback', { expiresIn: '1h' });
  
  const res = await fetch('http://localhost:3000/api/quotations/2534/pdf', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
test();
