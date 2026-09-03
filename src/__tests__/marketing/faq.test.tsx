import { render, screen, fireEvent } from '@testing-library/react';
import { FAQ } from '@/components/marketing/FAQ';

describe('FAQ', () => {
  it('renders section title', () => {
    render(<FAQ />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('renders all 5 FAQ questions', () => {
    render(<FAQ />);
    expect(screen.getByText('Is this free?')).toBeInTheDocument();
    expect(screen.getByText('How many people can join my household?')).toBeInTheDocument();
    expect(screen.getByText('Do I need to download an app?')).toBeInTheDocument();
    expect(screen.getByText('Can I share specific items only?')).toBeInTheDocument();
    expect(screen.getByText('Is my data secure?')).toBeInTheDocument();
  });

  it('answers are collapsed by default', () => {
    render(<FAQ />);
    expect(screen.queryByText('Yes! Our core features are completely free for households of any size.')).not.toBeInTheDocument();
  });

  it('expands answer when clicking question', () => {
    render(<FAQ />);
    const question = screen.getByText('Is this free?');
    fireEvent.click(question);
    expect(screen.getByText('Yes! Our core features are completely free for households of any size.')).toBeInTheDocument();
  });

  it('collapses answer when clicking again', () => {
    render(<FAQ />);
    const question = screen.getByText('Is this free?');
    fireEvent.click(question);
    expect(screen.getByText('Yes! Our core features are completely free for households of any size.')).toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.queryByText('Yes! Our core features are completely free for households of any size.')).not.toBeInTheDocument();
  });

  it('only one answer open at a time', () => {
    render(<FAQ />);
    const questions = screen.getAllByRole('button');
    
    fireEvent.click(questions[0]);
    expect(screen.getByText('Yes! Our core features are completely free for households of any size.')).toBeInTheDocument();
    
    fireEvent.click(questions[1]);
    expect(screen.queryByText('Yes! Our core features are completely free for households of any size.')).not.toBeInTheDocument();
    expect(screen.getByText('Unlimited! Add all family members, roommates, or partners.')).toBeInTheDocument();
  });

  it('has proper touch target size (min-h-44px)', () => {
    render(<FAQ />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const className = button.className;
      expect(className).toContain('min-h-[44px]');
    });
  });
});
