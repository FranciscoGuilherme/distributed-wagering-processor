import { Column, PrimaryColumn } from 'typeorm';

export default class BaseModel {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column({ type: 'timestamptz', name: 'created_at' })
  declare createdAt: Date;
}
