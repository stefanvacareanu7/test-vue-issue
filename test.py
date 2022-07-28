import unittest

class someMethods:

    def __init__(self, a, b):
        self.a = int(a)
        self.b = int(b)

    def summ(self):
        return int(self.a+self.b)

    def diff(self):
        return int(self.a-self.b)

    def multiple(self):
        return int(self.a*self.b)
    
    def getter(self):
        return self.a
    
    def setter(a):
        self.a = a

class TestStringMethods(unittest.TestCase):

    def test_summ(self):
        s1 = someMethods(1,2)
        self.assertEqual(s1.summ(),3)

        def test_diff(self):
             s1 = someMethods(1,2)
             self.assertEqual(s1.diff(),-1)

    def test_mul(self):
                s1 = someMethods(1,2)
                self.assertEqual(s1.multiple(),2)

unittest.main()

