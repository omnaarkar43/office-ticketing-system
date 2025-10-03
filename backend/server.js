const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Database setup
const db = new sqlite3.Database('./tickets.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables with proper serialization
function initializeDatabase() {
  db.serialize(() => {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating users table:', err);
    });

    // Create tickets table
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      ticket_no TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      employee_email TEXT NOT NULL,
      department TEXT NOT NULL,
      location TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'Open',
      assigned_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      frozen INTEGER DEFAULT 0
    )`, (err) => {
      if (err) console.error('Error creating tickets table:', err);
    });

    // Create attachments table
    db.run(`CREATE TABLE IF NOT EXISTS attachments (
      attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_no) REFERENCES tickets(ticket_no)
    )`, (err) => {
      if (err) console.error('Error creating attachments table:', err);
    });

    // Create status_logs table
    db.run(`CREATE TABLE IF NOT EXISTS status_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      comment TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_no) REFERENCES tickets(ticket_no)
    )`, (err) => {
      if (err) console.error('Error creating status_logs table:', err);
    });

    // Create default admin user (password: admin123)
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (name, email, password, role, department) 
            VALUES (?, ?, ?, ?, ?)`,
      ['Admin User', 'admin@office.com', hashedPassword, 'admin', 'IT'],
      (err) => {
        if (err) console.error('Error creating admin user:', err);
      }
    );
    
    // Create default manager user (password: manager123)
    const managerPassword = bcrypt.hashSync('manager123', 10);
    db.run(`INSERT OR IGNORE INTO users (name, email, password, role, department) 
            VALUES (?, ?, ?, ?, ?)`,
      ['Manager User', 'manager@office.com', managerPassword, 'manager', 'Foundation'],
      (err) => {
        if (err) {
          console.error('Error creating manager user:', err);
        } else {
          console.log('Database initialized with default users');
        }
      }
    );
  });
}

// Email configuration (Gmail example) - OPTIONAL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com', // Change this
    pass: 'your-app-password'      // Use App Password, not regular password
  }
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only images, PDFs, and documents allowed.'));
  }
});

// Generate ticket number
function generateTicketNumber() {
  return new Promise((resolve, reject) => {
    const year = new Date().getFullYear();
    const prefix = `OFF-${year}-`;
    
    db.get(
      `SELECT ticket_no FROM tickets WHERE ticket_no LIKE ? ORDER BY ticket_no DESC LIMIT 1`,
      [`${prefix}%`],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          let number = 1;
          if (row) {
            const lastNumber = parseInt(row.ticket_no.split('-')[2]);
            number = lastNumber + 1;
          }
          const ticketNo = `${prefix}${String(number).padStart(4, '0')}`;
          resolve(ticketNo);
        }
      }
    );
  });
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Send email notification (optional - will fail silently if not configured)
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: '"Office Ticketing System" <your-email@gmail.com>',
      to: to,
      subject: subject,
      html: html
    });
    console.log('Email sent to:', to);
  } catch (error) {
    console.error('Error sending email:', error.message);
    // Don't throw error - email is optional
  }
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Register new user (admin only)
app.post('/api/register', async (req, res) => {
  const { name, email, password, role, department } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      `INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, role || 'employee', department],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Email already exists or invalid data' });
        }
        res.json({ message: 'User registered successfully', userId: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public user registration (for employees)
app.post('/api/register-user', async (req, res) => {
  const { name, email, password, department } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      `INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, 'employee', department || 'General'],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Email already exists or invalid data' });
        }
        res.json({ message: 'Account created successfully', userId: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  });
});

// Create new ticket
// Create new ticket - accept both FormData and JSON
app.post('/api/tickets', upload.array('attachments', 3), async (req, res) => {
  try {
    const { employee_name, employee_email, department, location, category, sub_category, description } = req.body;
    
    // Validate required fields
    if (!employee_name || !employee_email || !department || !location || !category || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const ticketNo = await generateTicketNumber();
    
    // Rest of the code remains the same...
    
    // Insert ticket
    db.run(
      `INSERT INTO tickets (ticket_no, employee_name, employee_email, department, location, category, sub_category, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketNo, employee_name, employee_email, department, location, category, sub_category, description, 'Open'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating ticket' });
        }
        
        // Insert attachments
        if (req.files && req.files.length > 0) {
          const attachmentStmt = db.prepare('INSERT INTO attachments (ticket_no, file_name, file_path) VALUES (?, ?, ?)');
          req.files.forEach(file => {
            attachmentStmt.run(ticketNo, file.originalname, file.path);
          });
          attachmentStmt.finalize();
        }
        
        // Log status
        db.run(
          'INSERT INTO status_logs (ticket_no, status, updated_by, comment) VALUES (?, ?, ?, ?)',
          [ticketNo, 'Open', employee_name, 'Ticket created']
        );
        
        // Send email confirmation
        const emailHtml = `
          <h2>Ticket Created Successfully</h2>
          <p>Dear ${employee_name},</p>
          <p>Your ticket has been created with the following details:</p>
          <ul>
            <li><strong>Ticket No:</strong> ${ticketNo}</li>
            <li><strong>Department:</strong> ${department}</li>
            <li><strong>Location:</strong> ${location}</li>
            <li><strong>Category:</strong> ${category}</li>
            <li><strong>Sub-Category:</strong> ${sub_category || 'N/A'}</li>
            <li><strong>Status:</strong> Open</li>
          </ul>
          <p><strong>Description:</strong> ${description}</p>
          <p>You will receive updates as your ticket progresses.</p>
          <p>Thank you,<br>IT Support Team</p>
        `;
        
        sendEmail(employee_email, `Ticket Created: ${ticketNo}`, emailHtml);
        
        res.json({ 
          message: 'Ticket created successfully', 
          ticketNo: ticketNo 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all tickets (with filters) - Admin/IT only
app.get('/api/tickets', authenticateToken, (req, res) => {
  const { status, department, location, category } = req.query;
  
  let query = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }
  if (location) {
    query += ' AND location = ?';
    params.push(location);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching tickets' });
    }
    res.json(rows);
  });
});

// Get user's own tickets only
app.get('/api/my-tickets', authenticateToken, (req, res) => {
  const userEmail = req.user.email;
  
  db.all(
    'SELECT * FROM tickets WHERE employee_email = ? ORDER BY created_at DESC',
    [userEmail],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching tickets' });
      }
      res.json(rows);
    }
  );
});

// Get department tickets (manager only)
app.get('/api/manager/tickets', authenticateToken, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  // Get manager's department
  db.get('SELECT department FROM users WHERE email = ?', [req.user.email], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Error fetching user data' });
    }
    
    const { status, location, category } = req.query;
    let query = 'SELECT * FROM tickets WHERE department = ?';
    const params = [user.department];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (location) {
      query += ' AND location = ?';
      params.push(location);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching tickets' });
      }
      res.json(rows);
    });
  });
});

// Get department statistics (manager only)
app.get('/api/manager/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  db.get('SELECT department FROM users WHERE email = ?', [req.user.email], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Error fetching user data' });
    }
    
    const stats = {};
    
    // Total tickets in department
    db.get('SELECT COUNT(*) as total FROM tickets WHERE department = ?', [user.department], (err, row) => {
      stats.total = row.total;
      stats.department = user.department;
      
      // Status breakdown
      db.all('SELECT status, COUNT(*) as count FROM tickets WHERE department = ? GROUP BY status', [user.department], (err, rows) => {
        stats.byStatus = rows;
        
        // Location breakdown
        db.all('SELECT location, COUNT(*) as count FROM tickets WHERE department = ? GROUP BY location', [user.department], (err, rows) => {
          stats.byLocation = rows;
          
          // Recent tickets
          db.all('SELECT * FROM tickets WHERE department = ? ORDER BY created_at DESC LIMIT 10', [user.department], (err, rows) => {
            stats.recentTickets = rows;
            res.json(stats);
          });
        });
      });
    });
  });
});

// Manager update ticket priority/assignment
app.put('/api/manager/tickets/:ticketNo/assign', authenticateToken, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  const { ticketNo } = req.params;
  const { assigned_to, comment } = req.body;
  
  // Verify ticket is in manager's department
  db.get('SELECT department FROM users WHERE email = ?', [req.user.email], (err, manager) => {
    if (err || !manager) {
      return res.status(500).json({ error: 'Error fetching user data' });
    }
    
    db.get('SELECT * FROM tickets WHERE ticket_no = ? AND department = ?', [ticketNo, manager.department], (err, ticket) => {
      if (err || !ticket) {
        return res.status(404).json({ error: 'Ticket not found or access denied' });
      }
      
      db.run(
        'UPDATE tickets SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE ticket_no = ?',
        [assigned_to, ticketNo],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating ticket' });
          }
          
          // Log the assignment
          db.run(
            'INSERT INTO status_logs (ticket_no, status, updated_by, comment) VALUES (?, ?, ?, ?)',
            [ticketNo, ticket.status, req.user.email, `Assigned to ${assigned_to}. ${comment || ''}`]
          );
          
          res.json({ message: 'Ticket assigned successfully' });
        }
      );
    });
  });
});

// Get single ticket details
app.get('/api/tickets/:ticketNo', (req, res) => {
  const { ticketNo } = req.params;
  
  db.get('SELECT * FROM tickets WHERE ticket_no = ?', [ticketNo], (err, ticket) => {
    if (err || !ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Get attachments
    db.all('SELECT * FROM attachments WHERE ticket_no = ?', [ticketNo], (err, attachments) => {
      // Get status logs
      db.all('SELECT * FROM status_logs WHERE ticket_no = ? ORDER BY updated_at DESC', [ticketNo], (err, logs) => {
        res.json({
          ...ticket,
          attachments: attachments || [],
          logs: logs || []
        });
      });
    });
  });
});

// Add comment to own ticket
app.post('/api/tickets/:ticketNo/comment', authenticateToken, (req, res) => {
  const { ticketNo } = req.params;
  const { comment } = req.body;
  const userEmail = req.user.email;
  
  // Verify user owns this ticket
  db.get('SELECT * FROM tickets WHERE ticket_no = ? AND employee_email = ?', 
    [ticketNo, userEmail], 
    (err, ticket) => {
      if (err || !ticket) {
        return res.status(404).json({ error: 'Ticket not found or access denied' });
      }
      
      // Add to status logs
      db.run(
        'INSERT INTO status_logs (ticket_no, status, updated_by, comment) VALUES (?, ?, ?, ?)',
        [ticketNo, ticket.status, userEmail, comment],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error adding comment' });
          }
          res.json({ message: 'Comment added successfully' });
        }
      );
    }
  );
});

// Update ticket status (Admin/IT only)
app.put('/api/tickets/:ticketNo/status', authenticateToken, (req, res) => {
  const { ticketNo } = req.params;
  const { status, comment, assigned_to } = req.body;
  const updatedBy = req.user.email;
  
  // Check if ticket is frozen
  db.get('SELECT * FROM tickets WHERE ticket_no = ?', [ticketNo], (err, ticket) => {
    if (err || !ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.frozen === 1) {
      return res.status(400).json({ error: 'Ticket is frozen and cannot be updated' });
    }
    
    // Check reopen logic
    if (status === 'Reopened' && ticket.status === 'Resolved') {
      const resolvedDate = new Date(ticket.resolved_at);
      const currentDate = new Date();
      const daysDiff = (currentDate - resolvedDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 5) {
        return res.status(400).json({ error: 'Ticket cannot be reopened after 5 days of resolution' });
      }
    }
    
    let updateQuery = 'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [status];
    
    if (status === 'Resolved') {
      updateQuery += ', resolved_at = CURRENT_TIMESTAMP';
    }
    
    if (assigned_to) {
      updateQuery += ', assigned_to = ?';
      params.push(assigned_to);
    }
    
    updateQuery += ' WHERE ticket_no = ?';
    params.push(ticketNo);
    
    db.run(updateQuery, params, function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating ticket' });
      }
      
      // Log status change
      db.run(
        'INSERT INTO status_logs (ticket_no, status, updated_by, comment) VALUES (?, ?, ?, ?)',
        [ticketNo, status, updatedBy, comment || '']
      );
      
      // Send email notification
      const emailHtml = `
        <h2>Ticket Status Updated</h2>
        <p>Dear ${ticket.employee_name},</p>
        <p>Your ticket <strong>${ticketNo}</strong> status has been updated to: <strong>${status}</strong></p>
        ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
        <p>Thank you,<br>IT Support Team</p>
      `;
      
      sendEmail(ticket.employee_email, `Ticket Updated: ${ticketNo}`, emailHtml);
      
      res.json({ message: 'Ticket updated successfully' });
    });
  });
});

// Freeze resolved tickets older than 5 days (run this periodically)
app.post('/api/tickets/freeze-old', authenticateToken, (req, res) => {
  db.run(
    `UPDATE tickets 
     SET frozen = 1 
     WHERE status = 'Resolved' 
     AND julianday('now') - julianday(resolved_at) > 5 
     AND frozen = 0`,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error freezing tickets' });
      }
      res.json({ message: `${this.changes} tickets frozen`, count: this.changes });
    }
  );
});

// Get dashboard statistics (Admin only)
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const stats = {};
  
  // Total tickets
  db.get('SELECT COUNT(*) as total FROM tickets', (err, row) => {
    stats.total = row.total;
    
    // Status breakdown
    db.all('SELECT status, COUNT(*) as count FROM tickets GROUP BY status', (err, rows) => {
      stats.byStatus = rows;
      
      // Department breakdown
      db.all('SELECT department, COUNT(*) as count FROM tickets GROUP BY department', (err, rows) => {
        stats.byDepartment = rows;
        
        // Recent tickets
        db.all('SELECT * FROM tickets ORDER BY created_at DESC LIMIT 10', (err, rows) => {
          stats.recentTickets = rows;
          res.json(stats);
        });
      });
    });
  });
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  db.all('SELECT user_id, name, email, role, department, created_at FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching users' });
    }
    res.json(rows);
  });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Default admin login: admin@office.com / admin123');
  console.log('Default manager login: manager@office.com / manager123');
});