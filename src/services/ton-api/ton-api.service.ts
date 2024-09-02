import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { WalletPay, CreateOrderRequest } from 'wallet-pay';

@Injectable()
export class WalletPayService {
  private walletPay: WalletPay;

  constructor() {
    this.walletPay = new WalletPay(
      'your-store-api-key',
    );
  }

  async createOrder(telegramUserId: string): Promise<any> {
    try {
      const response = await this.walletPay.createOrder({
        
      }))
    }
  }



  async createTransaction(transactionDetails: any): Promise<any> {
    try {
      const response = await this.walletPay.createTransaction(transactionDetails);
      return response;
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Add more methods as required by the Wallet Pay API
}
