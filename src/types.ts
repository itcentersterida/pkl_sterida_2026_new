export type UserRole = 'admin' | 'supervisor' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  status: 'active' | 'inactive';
  class?: string;
  major?: string;
  createdAt: any;
}

export interface InternshipLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  supervisorIds: string[];
  createdAt: any;
}

export interface Assignment {
  id: string;
  studentId: string;
  locationId: string;
  supervisorId: string;
  status: 'active' | 'completed';
  startDate: any;
  endDate: any;
}

export interface Attendance {
  id: string;
  studentId: string;
  locationId: string;
  date: string; // YYYY-MM-DD
  checkIn?: {
    time: any;
    photoURL: string;
    latitude: number;
    longitude: number;
    status: 'valid' | 'invalid';
  };
  checkOut?: {
    time: any;
    photoURL: string;
    latitude: number;
    longitude: number;
    status: 'valid' | 'invalid';
  };
  type: 'present' | 'permit' | 'sick';
  createdAt: any;
}

export interface Journal {
  id: string;
  studentId: string;
  locationId: string;
  date: string;
  content: string;
  photos: string[];
  status: 'pending' | 'approved' | 'rejected';
  supervisorSignature?: string;
  updatedAt: any;
}

export interface ActivityLogItem {
  id: string;
  type: 'supervisor_action' | 'student_activity';
  action: string;
  userId: string;
  userName: string;
  targetId?: string;
  targetName?: string;
  timestamp: any;
  metadata?: any;
}
