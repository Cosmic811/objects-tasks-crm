export type Role = 'manager' | 'executor'
export type Status = 'new' | 'in_progress' | 'review' | 'accepted' | 'revision'
export type Profile = {
  id: string
  role: Role
  display_name: string
  created_at: string
}
export type Building = {
  id: string
  name: string
  address: string
  created_at: string
  deleted_at: string | null
}
export type Task = {
  id: string
  object_id: string
  title: string
  description: string
  assignee_id: string
  created_by: string
  status: Status
  created_at: string
  updated_at: string
  deleted_at: string | null
}
export type History = {
  id: string
  task_id: string
  actor_id: string
  from_status: Status | null
  to_status: Status
  comment: string | null
  created_at: string
}
type Table<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] }
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>
      objects: Table<Building>
      tasks: Table<Task>
      task_status_history: Table<History>
    }
    Views: Record<string, never>
    Enums: { app_role: Role; task_status: Status }
    CompositeTypes: Record<string, never>
    Functions: {
      save_object: {
        Args: { p_id: string | null; p_name: string; p_address: string }
        Returns: string
      }
      save_task: {
        Args: {
          p_id: string | null
          p_object_id: string
          p_title: string
          p_description: string
          p_assignee_id: string
          p_expected_updated_at?: string | null
        }
        Returns: string
      }
      transition_task: {
        Args: {
          p_task_id: string
          p_to_status: Status
          p_expected_updated_at: string
          p_comment?: string | null
        }
        Returns: string
      }
      delete_task: {
        Args: { p_task_id: string; p_expected_updated_at: string }
        Returns: undefined
      }
      delete_object: { Args: { p_object_id: string }; Returns: undefined }
    }
  }
}
