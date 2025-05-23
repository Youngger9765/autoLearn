import { render, screen } from '@testing-library/react';
import GenerateCourse from '../../pages/generate';

jest.mock('react-syntax-highlighter', () => ({
  Prism: (props: any) => <pre>{props.children}</pre>,
  Light: (props: any) => <pre>{props.children}</pre>,
  default: (props: any) => <pre>{props.children}</pre>,
}));

jest.mock('react-markdown', () => (props: any) => <div>{props.children}</div>);

describe('GenerateCourse', () => {
  it('renders input for course prompt', () => {
    render(<GenerateCourse />);
    expect(screen.getByPlaceholderText('請輸入你想學習的主題或需求描述...')).toBeInTheDocument();
  });
}); 