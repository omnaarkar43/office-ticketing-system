import React, { useState, useEffect } from 'react';
import { FileText, Send, LogOut, BarChart3, User, Plus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function TicketingSystem() {
  const [currentView, setCurrentView] = useState('home');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: ''
  });
  const [ticketForm, setTicketForm] = useState({
    employee_name: '',
    employee_email: '',
    department: '',
    location: '',
    category: '',
    sub_category: '',
    description: ''
  });
  const [attachments, setAttachments] = useState([]);
  const [commentText, setCommentText] = useState('');

  const departments = ['Foundation', 'Family office', 'Eithrconsulting', 'Accounts', 'Others', "CEO's office", "Founder's office"];
  const locations = ['Bandra', 'Thane', 'Pune', 'Velhe', 'Devrukh', 'Others'];
  const categories = {
    'Laptop': ['Unable to start', 'Hangs', 'Stuck at screen', 'Mic not working', 'Speaker not working', 'Camera not working'],
    'Anti-virus': ['Renewal'],
    'Emails': ['Signature issue', 'Not receiving', 'Unable to send'],
    'Outlook': ['Signature', 'Not receiving', 'Unable to send', 'Stuck'],
    'Wi-Fi issue': ['Not working', 'Unable to connect', 'Internet down'],
    'Video conferencing': ['Mic not working', 'Speaker not working', 'App crashing'],
    'Zoom': ['App crashing', 'Mic issue', 'Camera issue', 'Speaker issue'],
    'Google Meet': ['App crashing', 'Mic issue', 'Camera issue', 'Speaker issue'],
    'Teams': ['App crashing', 'Mic issue', 'Camera issue', 'Speaker issue'],
    'Backup': ['Data backup needed', 'Access to backup required'],
    'Firewall': ['Blocking websites'],
    'License upgrade': ['MS Office', 'Antivirus', 'Zoom'],
    'Word/Excel/PowerPoint not working': ['Unable to save data'],
    'Printer': ['Error', 'Offline', 'Not printing', 'Scanner not working', 'Pages stuck']
  };

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'it') {
        if (currentView === 'dashboard' || currentView === 'tickets') {
          fetchAllTickets();
          fetchStats();
        }
      } else if (user.role === 'manager') {
        if (currentView === 'manager-dashboard' || currentView === 'manager-tickets') {
          fetchManagerTickets();
          fetchManagerStats();
        }
      } else {
        if (currentView === 'my-tickets') {
          fetchMyTickets();
        }
      }
    }
  }, [user, currentView, filters]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_URL}/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const userData = JSON.parse(atob(token.split('.')[1]));
        setUser(userData);
        if (userData.role === 'admin' || userData.role === 'it') {
          setCurrentView('dashboard');
        } else if (userData.role === 'manager') {
          setCurrentView('manager-dashboard');
        } else {
          setCurrentView('my-tickets');
        }
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setMessage({ type: 'error', text: 'Please enter email and password' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        if (data.user.role === 'admin' || data.user.role === 'it') {
          setCurrentView('dashboard');
        } else if (data.user.role === 'manager') {
          setCurrentView('manager-dashboard');
        } else {
          setCurrentView('my-tickets');
        }
        setMessage({ type: 'success', text: 'Login successful!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Login failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password || !registerForm.department) {
      setMessage({ type: 'error', text: 'Please fill all required fields' });
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (registerForm.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_URL}/register-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
          department: registerForm.department
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account created! Please login.' });
        setTimeout(() => {
          setCurrentView('login');
          setRegisterForm({
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
            department: ''
          });
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Registration failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
  localStorage.removeItem('token');
  setToken(null);
  setUser(null);
  setTickets([]);           // ADD THIS
  setSelectedTicket(null);  // ADD THIS
  setStats(null);           // ADD THIS
  setFilters({});           // ADD THIS
  setCurrentView('home');
  };

  const handleCreateTicket = async () => {
  if (!ticketForm.employee_name || !ticketForm.employee_email || !ticketForm.department || !ticketForm.location || !ticketForm.category || !ticketForm.description) {
    setMessage({ type: 'error', text: 'Please fill all required fields' });
    return;
  }

  setLoading(true);
  setMessage({ type: '', text: '' });

  // Send as JSON instead of FormData (no files)
  try {
    const response = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketForm)
    });

    const data = await response.json();

    if (response.ok) {
      setMessage({ type: 'success', text: `Ticket created successfully! Ticket No: ${data.ticketNo}` });
      
      // Clear form
      setTicketForm({
        employee_name: '',
        employee_email: '',
        department: '',
        location: '',
        category: '',
        sub_category: '',
        description: ''
      });
      
      // Redirect after 3 seconds
      setTimeout(() => {
        setCurrentView('home');
        setMessage({ type: '', text: '' });
      }, 3000);
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to create ticket' });
    }
  } catch (error) {
    setMessage({ type: 'error', text: 'Network error. Please try again.' });
  } finally {
    setLoading(false);
  }
};

  const fetchAllTickets = async () => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(`${API_URL}/tickets${queryParams ? '?' + queryParams : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchMyTickets = async () => {
    try {
      const response = await fetch(`${API_URL}/my-tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchManagerTickets = async () => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(`${API_URL}/manager/tickets${queryParams ? '?' + queryParams : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchManagerStats = async () => {
    try {
      const response = await fetch(`${API_URL}/manager/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateTicketStatus = async (ticketNo, status, comment = '') => {
    try {
      const response = await fetch(`${API_URL}/tickets/${ticketNo}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, comment })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Ticket status updated!' });
        fetchAllTickets();
        if (selectedTicket) {
          fetchTicketDetails(ticketNo);
        }
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update ticket' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  };

  const addComment = async (ticketNo) => {
    if (!commentText.trim()) return;

    try {
      const response = await fetch(`${API_URL}/tickets/${ticketNo}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comment: commentText })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Comment added!' });
        setCommentText('');
        fetchTicketDetails(ticketNo);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to add comment' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  const assignTicket = async (ticketNo, assignedTo) => {
    try {
      const response = await fetch(`${API_URL}/manager/tickets/${ticketNo}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assigned_to: assignedTo, comment: `Assigned to ${assignedTo}` })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Ticket assigned successfully!' });
        fetchManagerTickets();
        if (selectedTicket) {
          fetchTicketDetails(ticketNo);
        }
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to assign ticket' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  const fetchTicketDetails = async (ticketNo) => {
    try {
      const response = await fetch(`${API_URL}/tickets/${ticketNo}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data);
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 3);
    setAttachments(files);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800';
      case 'Work In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      case 'Reopened': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // HOME VIEW
  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Office Ticketing</h1>
            <p className="text-gray-600 mt-2">Manage your IT support tickets</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => setCurrentView('login')}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              Login to Your Account
            </button>
            <button
              onClick={() => setCurrentView('register')}
              className="w-full bg-white text-indigo-600 py-3 rounded-lg border-2 border-indigo-600 hover:bg-indigo-50 transition font-semibold"
            >
              Create New Account
            </button>
            <button
              onClick={() => setCurrentView('create-ticket')}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition font-semibold"
            >
              Create Ticket (No Login Required)
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-500 text-center">
            Admin login: admin@office.com / admin123<br/>
            Manager login: manager@office.com / manager123
          </div>
        </div>
      </div>
    );
  }

  // LOGIN VIEW
  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Office Ticketing</h1>
            <p className="text-gray-600 mt-2">Manage your IT support tickets</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="your-email@office.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Password"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-semibold"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>

          <div className="mt-6 text-center space-y-2">
            <button
              onClick={() => setCurrentView('register')}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Create New Account
            </button>
            <div className="text-gray-400">or</div>
            <button
              onClick={() => setCurrentView('home')}
              className="text-gray-600 hover:text-gray-700 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // REGISTER VIEW
  if (currentView === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Create Account</h1>
            <p className="text-gray-600 mt-2">Register to track your tickets</p>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="your-email@office.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={registerForm.department}
                onChange={(e) => setRegisterForm({ ...registerForm, department: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={registerForm.confirmPassword}
                onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Confirm password"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-semibold"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView('login')}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Already have an account? Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CREATE TICKET VIEW (Anonymous)
  if (currentView === 'create-ticket') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Create Support Ticket</h1>
                <p className="text-gray-600 mt-2">Submit your IT support request</p>
              </div>
              <button
                onClick={() => setCurrentView('home')}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Back
              </button>
            </div>

            {message.text && (
              <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message.text}
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={ticketForm.employee_name}
                    onChange={(e) => setTicketForm({ ...ticketForm, employee_name: e.target.value })}
                    autoComplete="off"  // ADD THIS
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={ticketForm.employee_email}
                    onChange={(e) => setTicketForm({ ...ticketForm, employee_email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={ticketForm.department}
                    onChange={(e) => setTicketForm({ ...ticketForm, department: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <select
                    value={ticketForm.location}
                    onChange={(e) => setTicketForm({ ...ticketForm, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Location</option>
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Issue Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => {
                      setTicketForm({ ...ticketForm, category: e.target.value, sub_category: '' });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Category</option>
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Category</label>
                  <select
                    value={ticketForm.sub_category}
                    onChange={(e) => setTicketForm({ ...ticketForm, sub_category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled={!ticketForm.category}
                  >
                    <option value="">Select Sub-Category</option>
                    {ticketForm.category && categories[ticketForm.category]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Please describe your issue in detail..."
                />
              </div>

              <button
                onClick={handleCreateTicket}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-semibold text-lg flex items-center justify-center gap-2"
              >
                <Send size={20} />
                {loading ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MANAGER DASHBOARD
  if ((currentView === 'manager-dashboard' || currentView === 'manager-tickets') && user && user.role === 'manager') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 w-10 h-10 rounded-lg flex items-center justify-center">
                  <FileText className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">Manager Dashboard</h1>
                  <p className="text-sm text-gray-600">{user.name} - {user.department} Department</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentView('manager-dashboard')}
                  className={`px-4 py-2 rounded-lg ${currentView === 'manager-dashboard' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <BarChart3 size={20} />
                </button>
                <button
                  onClick={() => setCurrentView('manager-tickets')}
                  className={`px-4 py-2 rounded-lg ${currentView === 'manager-tickets' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <FileText size={20} />
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message.text}
            </div>
          )}

          {currentView === 'manager-dashboard' && stats && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Department Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Tickets</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
                    </div>
                    <FileText className="text-purple-600" size={32} />
                  </div>
                </div>
                {stats.byStatus?.map(item => (
                  <div key={item.status} className="bg-white p-6 rounded-xl shadow-sm border">
                    <div>
                      <p className="text-sm text-gray-600">{item.status}</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">{item.count}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">By Location</h3>
                  <div className="space-y-3">
                    {stats.byLocation?.map(item => (
                      <div key={item.location} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">{item.location}</span>
                        <span className="text-gray-600">{item.count} tickets</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Tickets</h3>
                  <div className="space-y-3">
                    {stats.recentTickets?.slice(0, 5).map(ticket => (
                      <div
                        key={ticket.ticket_no}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          fetchTicketDetails(ticket.ticket_no);
                          setCurrentView('manager-tickets');
                        }}
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-800">{ticket.ticket_no}</p>
                          <p className="text-xs text-gray-600">{ticket.employee_name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'manager-tickets' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Department Tickets</h2>
                  
                  <div className="flex gap-3 mb-6">
                    <select
                      onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Status</option>
                      <option value="Open">Open</option>
                      <option value="Work In Progress">WIP</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                    <select
                      onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">All Locations</option>
                      {locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {tickets.map(ticket => (
                      <div
                        key={ticket.ticket_no}
                        className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                          selectedTicket?.ticket_no === ticket.ticket_no ? 'border-purple-500 bg-purple-50' : ''
                        }`}
                        onClick={() => fetchTicketDetails(ticket.ticket_no)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{ticket.ticket_no}</p>
                            <p className="text-sm text-gray-600">{ticket.employee_name}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{ticket.category}</p>
                        <p className="text-xs text-gray-500">{ticket.location} {ticket.assigned_to ? `• Assigned to: ${ticket.assigned_to}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedTicket && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Ticket Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Ticket No</p>
                      <p className="font-semibold">{selectedTicket.ticket_no}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                        {selectedTicket.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Employee</p>
                      <p className="font-medium">{selectedTicket.employee_name}</p>
                      <p className="text-sm text-gray-500">{selectedTicket.employee_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Location</p>
                      <p className="font-medium">{selectedTicket.location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Issue</p>
                      <p className="font-medium">{selectedTicket.category}</p>
                      {selectedTicket.sub_category && (
                        <p className="text-sm text-gray-500">{selectedTicket.sub_category}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Description</p>
                      <p className="text-sm">{selectedTicket.description}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Assigned To</p>
                      <p className="text-sm font-medium">{selectedTicket.assigned_to || 'Unassigned'}</p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-2">Assign Ticket</p>
                      <input
                        type="text"
                        placeholder="Enter assignee name/email"
                        className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            assignTicket(selectedTicket.ticket_no, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <p className="text-xs text-gray-500">Press Enter to assign</p>
                    </div>

                    {selectedTicket.logs && selectedTicket.logs.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-gray-600 mb-2">Activity Log</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedTicket.logs.map(log => (
                            <div key={log.log_id} className="bg-gray-50 p-2 rounded text-xs">
                              <p className="font-medium">{log.status}</p>
                              {log.comment && <p className="text-gray-600">{log.comment}</p>}
                              <p className="text-gray-500">{new Date(log.updated_at).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // USER DASHBOARD (My Tickets)
  if (currentView === 'my-tickets' && user && user.role === 'employee') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center">
                  <FileText className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">My Tickets</h1>
                  <p className="text-sm text-gray-600">Welcome, {user.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentView('create-ticket')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  New Ticket
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message.text}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Your Tickets</h2>
            
            {tickets.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 mb-4">No tickets yet</p>
                <button
                  onClick={() => setCurrentView('create-ticket')}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <div
                    key={ticket.ticket_no}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      fetchTicketDetails(ticket.ticket_no);
                      setSelectedTicket(ticket);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{ticket.ticket_no}</p>
                        <p className="text-sm text-gray-600">{ticket.category}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{ticket.description.substring(0, 100)}...</p>
                    <p className="text-xs text-gray-500">{new Date(ticket.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTicket && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Ticket Details</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Ticket No</p>
                  <p className="font-semibold">{selectedTicket.ticket_no}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-medium">{selectedTicket.category}</p>
                  {selectedTicket.sub_category && (
                    <p className="text-sm text-gray-500">{selectedTicket.sub_category}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-sm">{selectedTicket.description}</p>
                </div>

                {selectedTicket.logs && selectedTicket.logs.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Activity Log</p>
                    <div className="space-y-2">
                      {selectedTicket.logs.map(log => (
                        <div key={log.log_id} className="bg-gray-50 p-3 rounded">
                          <p className="text-sm font-medium">{log.status}</p>
                          {log.comment && <p className="text-sm text-gray-600">{log.comment}</p>}
                          <p className="text-xs text-gray-500">{new Date(log.updated_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600 mb-2">Add Comment</p>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Add additional information..."
                  />
                  <button
                    onClick={() => addComment(selectedTicket.ticket_no)}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center">
                <FileText className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Office Ticketing System</h1>
                <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg ${currentView === 'dashboard' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <BarChart3 size={20} />
              </button>
              <button
                onClick={() => setCurrentView('tickets')}
                className={`px-4 py-2 rounded-lg ${currentView === 'tickets' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <FileText size={20} />
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'dashboard' && stats && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Tickets</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
                  </div>
                  <FileText className="text-indigo-600" size={32} />
                </div>
              </div>
              {stats.byStatus?.map(item => (
                <div key={item.status} className="bg-white p-6 rounded-xl shadow-sm border">
                  <div>
                    <p className="text-sm text-gray-600">{item.status}</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{item.count}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Tickets</h3>
              <div className="space-y-3">
                {stats.recentTickets?.map(ticket => (
                  <div
                    key={ticket.ticket_no}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      fetchTicketDetails(ticket.ticket_no);
                      setCurrentView('tickets');
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{ticket.ticket_no}</p>
                      <p className="text-sm text-gray-600">{ticket.category} - {ticket.employee_name}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">All Tickets</h2>
                
                <div className="flex gap-3 mb-6">
                  <select
                    onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">All Status</option>
                    <option value="Open">Open</option>
                    <option value="Work In Progress">WIP</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <select
                    onChange={(e) => setFilters({ ...filters, department: e.target.value || undefined })}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.ticket_no}
                      className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                        selectedTicket?.ticket_no === ticket.ticket_no ? 'border-indigo-500 bg-indigo-50' : ''
                      }`}
                      onClick={() => fetchTicketDetails(ticket.ticket_no)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-800">{ticket.ticket_no}</p>
                          <p className="text-sm text-gray-600">{ticket.employee_name}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{ticket.category}</p>
                      <p className="text-xs text-gray-500">{ticket.department} • {ticket.location}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedTicket && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Ticket Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Ticket No</p>
                    <p className="font-semibold">{selectedTicket.ticket_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Employee</p>
                    <p className="font-medium">{selectedTicket.employee_name}</p>
                    <p className="text-sm text-gray-500">{selectedTicket.employee_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Department & Location</p>
                    <p className="font-medium">{selectedTicket.department}</p>
                    <p className="text-sm text-gray-500">{selectedTicket.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Issue</p>
                    <p className="font-medium">{selectedTicket.category}</p>
                    {selectedTicket.sub_category && (
                      <p className="text-sm text-gray-500">{selectedTicket.sub_category}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="text-sm">{selectedTicket.description}</p>
                  </div>

                  {(user.role === 'admin' || user.role === 'it') && (
                    <div className="pt-4 border-t space-y-3">
                      <button
                        onClick={() => updateTicketStatus(selectedTicket.ticket_no, 'Work In Progress')}
                        className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        Mark as WIP
                      </button>
                      <button
                        onClick={() => updateTicketStatus(selectedTicket.ticket_no, 'Resolved')}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Mark as Resolved
                      </button>
                      <button
                        onClick={() => updateTicketStatus(selectedTicket.ticket_no, 'Closed')}
                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        Close Ticket
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}