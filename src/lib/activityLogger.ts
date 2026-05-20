import { collection, addDoc, serverTimestamp } from './firebase';
import { db } from './firebase';

export type ActivityAction = 
  | 'approve_journal' 
  | 'reject_journal' 
  | 'verify_attendance' 
  | 'assign_student' 
  | 'update_user_role'
  | 'create_location';

interface LogActivityProps {
  type: 'supervisor_action' | 'student_activity';
  action: string;
  userId: string;
  userName: string;
  targetId?: string;
  targetName?: string;
  metadata?: any;
}

export const logActivity = async ({
  type,
  action,
  userId,
  userName,
  targetId,
  targetName,
  metadata
}: LogActivityProps) => {
  try {
    await addDoc(collection(db, 'activities'), {
      type,
      action,
      userId,
      userName,
      targetId: targetId || null,
      targetName: targetName || null,
      timestamp: serverTimestamp(),
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
