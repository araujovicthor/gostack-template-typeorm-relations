import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const existingProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existingProducts.length) {
      throw new AppError('Products not found');
    }

    const existingProductsIds = existingProducts.map(product => product.id);

    const checkInexistingProducts = products.filter(
      product => !existingProductsIds.includes(product.id),
    );

    if (checkInexistingProducts.length) {
      throw new AppError(`Product ${checkInexistingProducts[0].id} not found`);
    }

    const findProductsWithoutStock = products.filter(
      product =>
        existingProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithoutStock.length) {
      throw new AppError(
        `Quantity ${findProductsWithoutStock[0].quantity} is not available for ${findProductsWithoutStock[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existingProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const updateProducts = products.map(product => ({
      id: product.id,
      quantity:
        existingProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateProducts);

    return order;
  }
}

export default CreateOrderService;
