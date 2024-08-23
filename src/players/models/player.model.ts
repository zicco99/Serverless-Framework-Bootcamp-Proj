import { Club } from "../../clubs/models/club.model";

export class Player {
  id: string;
  name: string;
  position: string;
  club: Club | string; 

  constructor(id: string, name: string, position: string, club: Club | string) {
    this.id = id;
    this.name = name;
    this.position = position;
    this.club = club;
  }
}
