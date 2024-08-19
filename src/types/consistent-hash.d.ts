declare module 'consistent-hash' {
    // Define the interface for ConsistentHash
    interface ConsistentHash<T> {
      add(node: T, weight?: number, points?: number[]): void;
      remove(node: T): void;
      get(key: string, count?: number): T | T[];
      getNodes(): T[];
      getPoints(node: T): number[];
    }
  
    // Export the ConsistentHash class
    export default class ConsistentHash<T> {
      constructor(
        range?: number, // Hash ring control point modulo range, default 100003
        weight?: number, // Default number of control points to create for each node, default 40
        distribution?: 'random' | 'uniform', // Node arrangement around the ring
        orderNodes?: (nodes: T[]) => T[] // Function to define the order of nodes
      );
  
      add(node: T, weight?: number, points?: number[]): void;
      remove(node: T): void;
      get(key: string, count?: number): T | null;
      getNodes(): T[];
      getPoints(node: T): number[];
    }
  }
  